from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.config import settings
from app.models.user import User, UserRole
from app.services.auth import (
    AuthService,
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def _build_user(
    *, id_: int = 1, email: str = "u@example.com", password: str = "secret123"
) -> User:
    return User(
        id=id_,
        email=email,
        hashed_password=hash_password(password),
        role=UserRole.user,
        name="User",
    )


async def test_register_creates_user_and_issues_token() -> None:
    repo = MagicMock()
    repo.get_by_email = AsyncMock(return_value=None)
    saved = _build_user()
    repo.create = AsyncMock(return_value=saved)

    service = AuthService(repo)
    user, token = await service.register(
        "u@example.com", "secret123", "User", UserRole.user
    )

    assert user is saved
    assert isinstance(token, str) and token
    repo.get_by_email.assert_awaited_once_with("u@example.com")
    repo.create.assert_awaited_once()

    payload = decode_token(token)
    assert payload["sub"] == str(saved.id)


async def test_register_rejects_duplicate_email() -> None:
    repo = MagicMock()
    repo.get_by_email = AsyncMock(return_value=_build_user())

    service = AuthService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.register(
            "u@example.com", "anything", "User", UserRole.user
        )
    assert exc.value.status_code == 400
    repo.create.assert_not_called() if hasattr(repo, "create") else None


async def test_login_with_valid_credentials_returns_token() -> None:
    user = _build_user(id_=42, password="right-password")
    repo = MagicMock()
    repo.get_by_email = AsyncMock(return_value=user)

    service = AuthService(repo)
    returned, token = await service.login(user.email, "right-password")

    assert returned.id == 42
    payload = decode_token(token)
    assert payload["sub"] == "42"


async def test_login_with_wrong_password_raises_401() -> None:
    user = _build_user(password="right-password")
    repo = MagicMock()
    repo.get_by_email = AsyncMock(return_value=user)

    service = AuthService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.login(user.email, "wrong-password")
    assert exc.value.status_code == 401


async def test_login_with_unknown_email_raises_401() -> None:
    repo = MagicMock()
    repo.get_by_email = AsyncMock(return_value=None)

    service = AuthService(repo)
    with pytest.raises(HTTPException) as exc:
        await service.login("ghost@example.com", "anything")
    assert exc.value.status_code == 401


def test_password_hash_round_trip() -> None:
    h = hash_password("pwd")
    assert verify_password("pwd", h) is True
    assert verify_password("nope", h) is False


def test_jwt_round_trip() -> None:
    token = create_access_token({"sub": "42", "role": "user"})
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "user"


def test_access_token_uses_configured_lifetime(monkeypatch) -> None:
    lifetime_minutes = 259200
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", lifetime_minutes)

    before = datetime.now(timezone.utc).timestamp()
    payload = decode_token(create_access_token({"sub": "42", "role": "user"}))
    after = datetime.now(timezone.utc).timestamp()

    assert before + lifetime_minutes * 60 - 1 <= payload["exp"]
    assert payload["exp"] <= after + lifetime_minutes * 60


def test_decode_token_rejects_garbage() -> None:
    with pytest.raises(HTTPException) as exc:
        decode_token("not-a-real-token")
    assert exc.value.status_code == 401
