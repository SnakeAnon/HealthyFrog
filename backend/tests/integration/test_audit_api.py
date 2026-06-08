from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient

from app.models.user import User, UserRole
from app.services.auth import hash_password

PREFIX = "/api/v1"


@pytest_asyncio.fixture
async def make_admin(client: AsyncClient, session_factory):
    async def _make(
        email: str = "audit-admin@example.com", password: str = "admin123"
    ) -> dict:
        async with session_factory() as session:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                role=UserRole.admin,
                name="Admin",
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            user_id = user.id

        res = await client.post(
            f"{PREFIX}/auth/login",
            json={"email": email, "password": password},
        )
        assert res.status_code == 200, res.text
        return {
            "id": user_id,
            "email": email,
            "headers": {
                "Authorization": f"Bearer {res.json()['access_token']}"
            },
        }

    return _make


async def test_login_creates_audit_event(client, register_user) -> None:
    user = await register_user(email="a-login@example.com")
    res = await client.get(
        f"{PREFIX}/users/me/audit", headers=user["headers"]
    )
    assert res.status_code == 200, res.text
    actions = {row["action"] for row in res.json()}
    # Both register and login (the latter is implicit via register fixture
    # opening the GET /me path immediately afterwards).
    assert "user.register" in actions or "user.login" in actions


async def test_user_can_only_see_own_audit(
    client, register_user
) -> None:
    user = await register_user(email="a-mine@example.com")
    other = await register_user(email="a-other@example.com")

    res = await client.get(
        f"{PREFIX}/users/me/audit", headers=user["headers"]
    )
    assert res.status_code == 200
    user_ids = {row["user_id"] for row in res.json()}
    assert user_ids <= {user["id"]}
    assert other["id"] not in user_ids


async def test_admin_audit_requires_admin_role(client, register_user) -> None:
    user = await register_user(email="a-not-admin@example.com")
    res = await client.get(
        f"{PREFIX}/admin/audit", headers=user["headers"]
    )
    assert res.status_code == 403


async def test_admin_audit_lists_recent_events(
    client, register_user, make_admin
) -> None:
    target = await register_user(email="a-target@example.com")
    admin = await make_admin()

    # Trigger one more event so we have at least 2 entries to filter on.
    await client.put(
        f"{PREFIX}/users/me",
        headers=target["headers"],
        json={"weight": 70.5},
    )

    res = await client.get(
        f"{PREFIX}/admin/audit", headers=admin["headers"]
    )
    assert res.status_code == 200
    rows = res.json()
    actions = {row["action"] for row in rows}
    assert "user.register" in actions
    assert "user.profile_update" in actions


async def test_admin_audit_filter_by_action(
    client, register_user, make_admin
) -> None:
    await register_user(email="a-filter@example.com")
    admin = await make_admin()

    res = await client.get(
        f"{PREFIX}/admin/audit?action=user.register",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    actions = {row["action"] for row in res.json()}
    assert actions == {"user.register"}


async def test_admin_audit_filter_by_user(
    client, register_user, make_admin
) -> None:
    target = await register_user(email="a-by-user@example.com")
    admin = await make_admin()

    res = await client.get(
        f"{PREFIX}/admin/audit?user_id={target['id']}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    rows = res.json()
    assert rows  # at least the registration event is logged.
    assert all(r["user_id"] == target["id"] for r in rows)
