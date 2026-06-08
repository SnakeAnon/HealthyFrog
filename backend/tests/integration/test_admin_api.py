from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient

from app.models.user import User, UserRole
from app.services.auth import hash_password

PREFIX = "/api/v1"


@pytest_asyncio.fixture
async def make_admin(client: AsyncClient, session_factory):

    async def _make(
        email: str = "admin@example.com", password: str = "admin123"
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
        token = res.json()["access_token"]
        return {
            "id": user_id,
            "email": email,
            "headers": {"Authorization": f"Bearer {token}"},
        }

    return _make


# --------------------------------------------------------------------------- #
# Authorization
# --------------------------------------------------------------------------- #


async def test_admin_endpoint_rejects_non_admin(client, register_user) -> None:
    user = await register_user(email="plain@example.com")
    res = await client.get(f"{PREFIX}/admin/users", headers=user["headers"])
    assert res.status_code == 403


async def test_admin_endpoint_requires_token(client) -> None:
    res = await client.get(f"{PREFIX}/admin/users")
    assert res.status_code in (401, 403)


async def test_register_rejects_admin_role(client) -> None:
    res = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "self-admin@example.com",
            "password": "secret123",
            "name": "Self-Admin",
            "role": "admin",
        },
    )
    assert res.status_code == 400


# --------------------------------------------------------------------------- #
# Listing / filtering
# --------------------------------------------------------------------------- #


async def test_list_users_returns_all(client, register_user, make_admin) -> None:
    await register_user(email="u1@example.com", role="user")
    await register_user(email="t1@example.com", role="trainer")
    admin = await make_admin()

    res = await client.get(f"{PREFIX}/admin/users", headers=admin["headers"])
    assert res.status_code == 200
    emails = {u["email"] for u in res.json()}
    assert {"u1@example.com", "t1@example.com", admin["email"]} <= emails


async def test_list_users_filtered_by_role(
    client, register_user, make_admin
) -> None:
    await register_user(email="u2@example.com", role="user")
    await register_user(email="t2@example.com", role="trainer")
    admin = await make_admin()

    res = await client.get(
        f"{PREFIX}/admin/users?role=trainer", headers=admin["headers"]
    )
    assert res.status_code == 200
    body = res.json()
    assert all(u["role"] == "trainer" for u in body)
    emails = {u["email"] for u in body}
    assert "t2@example.com" in emails
    assert "u2@example.com" not in emails


async def test_list_users_search_by_name(
    client, register_user, make_admin
) -> None:
    await register_user(email="alice@example.com", name="Alice", role="user")
    await register_user(email="bob@example.com", name="Bob", role="user")
    admin = await make_admin()

    res = await client.get(
        f"{PREFIX}/admin/users?search=ali", headers=admin["headers"]
    )
    assert res.status_code == 200
    emails = {u["email"] for u in res.json()}
    assert "alice@example.com" in emails
    assert "bob@example.com" not in emails


# --------------------------------------------------------------------------- #
# Get / update / delete
# --------------------------------------------------------------------------- #


async def test_get_user_returns_card(client, register_user, make_admin) -> None:
    target = await register_user(email="card@example.com")
    admin = await make_admin()

    res = await client.get(
        f"{PREFIX}/admin/users/{target['id']}", headers=admin["headers"]
    )
    assert res.status_code == 200
    assert res.json()["email"] == "card@example.com"


async def test_get_user_404_when_missing(client, make_admin) -> None:
    admin = await make_admin()
    res = await client.get(
        f"{PREFIX}/admin/users/99999", headers=admin["headers"]
    )
    assert res.status_code == 404


async def test_patch_user_updates_role_and_profile(
    client, register_user, make_admin
) -> None:
    target = await register_user(email="promote@example.com", role="user")
    admin = await make_admin()

    res = await client.patch(
        f"{PREFIX}/admin/users/{target['id']}",
        headers=admin["headers"],
        json={"role": "trainer", "name": "New Name"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["role"] == "trainer"
    assert body["name"] == "New Name"


async def test_admin_cannot_demote_self(client, make_admin) -> None:
    admin = await make_admin()
    res = await client.patch(
        f"{PREFIX}/admin/users/{admin['id']}",
        headers=admin["headers"],
        json={"role": "user"},
    )
    assert res.status_code == 400


async def test_admin_can_keep_own_role(client, make_admin) -> None:
    """Setting the same role on yourself should be a no-op, not 400."""
    admin = await make_admin()
    res = await client.patch(
        f"{PREFIX}/admin/users/{admin['id']}",
        headers=admin["headers"],
        json={"role": "admin", "name": "Renamed Admin"},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Renamed Admin"


async def test_delete_user_succeeds(client, register_user, make_admin) -> None:
    target = await register_user(email="delete-me@example.com")
    admin = await make_admin()

    res = await client.delete(
        f"{PREFIX}/admin/users/{target['id']}", headers=admin["headers"]
    )
    assert res.status_code == 204

    follow_up = await client.get(
        f"{PREFIX}/admin/users/{target['id']}", headers=admin["headers"]
    )
    assert follow_up.status_code == 404


async def test_admin_cannot_delete_self(client, make_admin) -> None:
    admin = await make_admin()
    res = await client.delete(
        f"{PREFIX}/admin/users/{admin['id']}", headers=admin["headers"]
    )
    assert res.status_code == 400


# --------------------------------------------------------------------------- #
# Stats
# --------------------------------------------------------------------------- #


async def test_stats_returns_counts(
    client, register_user, make_admin
) -> None:
    await register_user(email="s-u@example.com", role="user")
    await register_user(email="s-t@example.com", role="trainer")
    admin = await make_admin()

    res = await client.get(f"{PREFIX}/admin/stats", headers=admin["headers"])
    assert res.status_code == 200
    body = res.json()
    assert body["total_users"] >= 3
    assert body["users_by_role"].get("user", 0) >= 1
    assert body["users_by_role"].get("trainer", 0) >= 1
    assert body["users_by_role"].get("admin", 0) >= 1
    for key in ("products", "meals", "messages", "bookings"):
        assert isinstance(body[key], int)
        assert body[key] >= 0
