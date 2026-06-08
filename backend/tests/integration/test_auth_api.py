from __future__ import annotations

PREFIX = "/api/v1"


async def test_register_returns_token(client) -> None:
    res = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "alice@example.com",
            "password": "secret123",
            "name": "Alice",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


async def test_register_duplicate_email_returns_400(client) -> None:
    payload = {"email": "bob@example.com", "password": "p", "name": "Bob"}
    first = await client.post(f"{PREFIX}/auth/register", json=payload)
    assert first.status_code == 200

    second = await client.post(f"{PREFIX}/auth/register", json=payload)
    assert second.status_code == 400


async def test_login_after_register(client) -> None:
    await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "carol@example.com",
            "password": "secret",
            "name": "Carol",
        },
    )
    res = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "carol@example.com", "password": "secret"},
    )
    assert res.status_code == 200
    assert res.json()["access_token"]


async def test_login_with_wrong_password_returns_401(client) -> None:
    await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "dan@example.com", "password": "right", "name": "Dan"},
    )
    res = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "dan@example.com", "password": "wrong"},
    )
    assert res.status_code == 401


async def test_protected_endpoint_requires_token(client) -> None:
    res = await client.get(f"{PREFIX}/users/me")
    assert res.status_code in (401, 403)


async def test_protected_endpoint_with_invalid_token(client) -> None:
    res = await client.get(
        f"{PREFIX}/users/me",
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert res.status_code == 401
