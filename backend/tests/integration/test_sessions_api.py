from __future__ import annotations

PREFIX = "/api/v1"


async def test_login_creates_session_row(
    client, register_user
) -> None:
    user = await register_user(email="s-login@example.com")
    res = await client.get(
        f"{PREFIX}/users/me/sessions", headers=user["headers"]
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) >= 1
    assert body[0]["revoked"] is False


async def test_logout_revokes_current_token(
    client, register_user
) -> None:
    user = await register_user(email="s-logout@example.com")
    res = await client.post(
        f"{PREFIX}/auth/logout", headers=user["headers"]
    )
    assert res.status_code == 200
    assert res.json()["revoked"] == 1

    res = await client.get(f"{PREFIX}/users/me", headers=user["headers"])
    assert res.status_code == 401


async def test_logout_all_revokes_every_session(
    client, register_user
) -> None:
    user = await register_user(email="s-all@example.com")

    second = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "s-all@example.com", "password": "password123"},
    )
    assert second.status_code == 200
    second_headers = {
        "Authorization": f"Bearer {second.json()['access_token']}"
    }

    res = await client.post(
        f"{PREFIX}/auth/logout-all", headers=user["headers"]
    )
    assert res.status_code == 200
    assert res.json()["revoked"] >= 2

    for h in (user["headers"], second_headers):
        r = await client.get(f"{PREFIX}/users/me", headers=h)
        assert r.status_code == 401


async def test_user_can_only_revoke_own_sessions(
    client, register_user
) -> None:
    owner = await register_user(email="s-owner@example.com")
    intruder = await register_user(email="s-intruder@example.com")

    sessions = (
        await client.get(
            f"{PREFIX}/users/me/sessions", headers=owner["headers"]
        )
    ).json()
    target_id = sessions[0]["id"]

    res = await client.delete(
        f"{PREFIX}/users/me/sessions/{target_id}",
        headers=intruder["headers"],
    )
    assert res.status_code == 404

    res = await client.delete(
        f"{PREFIX}/users/me/sessions/{target_id}",
        headers=owner["headers"],
    )
    assert res.status_code == 204


async def test_legacy_token_without_jti_still_accepted(
    client, register_user
) -> None:
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from app.config import settings

    user = await register_user(email="s-legacy@example.com")
    legacy_token = jwt.encode(
        {
            "sub": str(user["id"]),
            "role": "user",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    res = await client.get(
        f"{PREFIX}/users/me",
        headers={"Authorization": f"Bearer {legacy_token}"},
    )
    assert res.status_code == 200, res.text


async def test_token_with_unknown_jti_is_rejected(client) -> None:
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from app.config import settings

    forged = jwt.encode(
        {
            "sub": "1",
            "role": "user",
            "jti": "not-a-real-session-jti",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    res = await client.get(
        f"{PREFIX}/users/me",
        headers={"Authorization": f"Bearer {forged}"},
    )
    assert res.status_code == 401
