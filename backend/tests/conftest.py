"""Shared pytest fixtures.

Test infrastructure:

* Environment variables required by ``app.config.Settings`` are populated
  *before* importing application modules so that the global ``settings``
  object is created against the test configuration.
* ``DATABASE_URL_TEST`` overrides the default in-memory SQLite database
  (useful for running the suite against a real PostgreSQL container).
* The schema is recreated for every test through the ``Base.metadata``
  declared by the application models, which keeps the suite hermetic and
  free from leakage between cases.
* The FastAPI application is reused across tests, but the ``get_db``
  dependency is overridden so that every request uses a session bound to
  the test engine.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make sure backend root is importable regardless of where pytest is invoked.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Configure environment BEFORE importing the application.
TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL_TEST", "sqlite+aiosqlite:///:memory:"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

from typing import AsyncIterator, Awaitable, Callable, Dict  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import models  # noqa: E402, F401  (registers ORM mappers on Base.metadata)
from app.database import Base, get_db  # noqa: E402
from app.dependencies import get_meal_analysis_service  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.meal_analysis import (  # noqa: E402
    AnalysisResponse,
    IngredientItem,
    VoiceAnalysisResponse,
)


def _engine_kwargs(url: str) -> dict:
    """Engine kwargs that make in-memory SQLite usable from async code."""
    if url.startswith("sqlite"):
        return {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }
    return {}


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL, **_engine_kwargs(TEST_DATABASE_URL))
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield eng
    finally:
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(session_factory) -> AsyncIterator[AsyncSession]:
    """Direct DB session for tests that don't need an HTTP client."""
    async with session_factory() as session:
        yield session


class FakeMealAnalysisService:
    """Stand-in for ``MealAnalysisService`` used by integration tests.

    Attributes ``text_response`` / ``photo_response`` / ``voice_response``
    can be overridden per-test via the ``fake_ai`` fixture; calls are
    recorded so tests can assert that the right code path executed.
    """

    def __init__(self) -> None:
        self.text_response = AnalysisResponse(
            dish_name="Oatmeal with berries",
            ingredients=[IngredientItem(name="Oatmeal", amount_grams=200)],
            estimated_weight=250.0,
            calories=320.0,
            proteins=12.0,
            fats=6.0,
            carbs=55.0,
            confidence=0.8,
            notes="ai-stub",
        )
        self.photo_response = AnalysisResponse(
            dish_name="Caesar salad",
            ingredients=[],
            estimated_weight=200.0,
            calories=180.0,
            proteins=8.0,
            fats=10.0,
            carbs=15.0,
            confidence=0.6,
        )
        self.voice_response = VoiceAnalysisResponse(
            transcribed_text="buckwheat with chicken, 350 grams",
            dish_name="Buckwheat with chicken",
            ingredients=[],
            estimated_weight=350.0,
            calories=420.0,
            proteins=30.0,
            fats=8.0,
            carbs=55.0,
        )
        self.calls: list[str] = []

    async def analyze_text(self, text: str) -> AnalysisResponse:
        self.calls.append(f"text:{text}")
        return self.text_response

    async def analyze_photo(
        self, image_bytes: bytes, mime_type: str
    ) -> AnalysisResponse:
        self.calls.append(f"photo:{mime_type}:{len(image_bytes)}")
        return self.photo_response

    async def analyze_voice(
        self, audio_bytes: bytes, mime_type: str
    ) -> VoiceAnalysisResponse:
        self.calls.append(f"voice:{mime_type}:{len(audio_bytes)}")
        return self.voice_response


@pytest.fixture
def fake_ai() -> FakeMealAnalysisService:
    return FakeMealAnalysisService()


@pytest_asyncio.fixture
async def client(
    session_factory, fake_ai: FakeMealAnalysisService
) -> AsyncIterator[AsyncClient]:
    """HTTP client wired to the FastAPI app with an isolated test database."""

    async def _get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_meal_analysis_service] = lambda: fake_ai
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# Higher-level helpers used by integration and scenario tests.
# --------------------------------------------------------------------------- #


RegisterFn = Callable[..., Awaitable[Dict[str, str]]]


@pytest_asyncio.fixture
async def register_user(client: AsyncClient) -> RegisterFn:
    """Register a user (or trainer) and return ``{token, headers, id, email}``."""

    async def _register(
        email: str = "user@example.com",
        password: str = "password123",
        name: str = "Test User",
        role: str = "user",
    ) -> Dict[str, str]:
        res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "name": name,
                "role": role,
            },
        )
        assert res.status_code == 200, res.text
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = await client.get("/api/v1/users/me", headers=headers)
        assert me.status_code == 200, me.text
        body = me.json()

        return {
            "token": token,
            "headers": headers,
            "id": body["id"],
            "email": body["email"],
            "role": body["role"],
            "name": body["name"],
        }

    return _register


@pytest.fixture
def anyio_backend() -> str:  # pragma: no cover - keeps anyio-style libs happy
    return "asyncio"
