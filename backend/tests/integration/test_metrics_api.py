from __future__ import annotations

from datetime import date, timedelta

PREFIX = "/api/v1"


async def test_post_weight_creates_log(client, register_user) -> None:
    user = await register_user(email="w-create@example.com")
    today = date.today().isoformat()
    res = await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": today, "weight": 72.5},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["date"] == today
    assert body["weight"] == 72.5
    assert "recorded_at" in body


async def test_post_weight_rejects_future_date(client, register_user) -> None:
    user = await register_user(email="w-future@example.com")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    res = await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": tomorrow, "weight": 70.0},
    )
    assert res.status_code == 422


async def test_post_weight_rejects_zero(client, register_user) -> None:
    user = await register_user(email="w-zero@example.com")
    res = await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": date.today().isoformat(), "weight": 0},
    )
    assert res.status_code == 422


async def test_post_weight_upserts_for_same_date(client, register_user) -> None:
    user = await register_user(email="w-upsert@example.com")
    today = date.today().isoformat()
    await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": today, "weight": 80.0},
    )
    await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": today, "weight": 79.0},
    )
    history = (
        await client.get(f"{PREFIX}/users/me/weight", headers=user["headers"])
    ).json()
    assert len(history) == 1
    assert history[0]["weight"] == 79.0


async def test_post_weight_updates_profile_weight(
    client, register_user
) -> None:
    user = await register_user(email="w-profile@example.com")
    await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": date.today().isoformat(), "weight": 65.5},
    )
    me = await client.get(f"{PREFIX}/users/me", headers=user["headers"])
    assert me.status_code == 200
    assert me.json()["weight"] == 65.5


async def test_get_history_with_range(client, register_user) -> None:
    user = await register_user(email="w-range@example.com")
    today = date.today()
    for offset, kg in enumerate([80.0, 79.5, 79.0, 78.7]):
        await client.post(
            f"{PREFIX}/users/me/weight",
            headers=user["headers"],
            json={
                "date": (today - timedelta(days=offset)).isoformat(),
                "weight": kg,
            },
        )
    res = await client.get(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        params={
            "from": (today - timedelta(days=2)).isoformat(),
            "to": today.isoformat(),
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 3
    assert body[0]["date"] < body[-1]["date"] or len(body) == 1


async def test_trend_endpoint(client, register_user) -> None:
    user = await register_user(email="w-trend@example.com")
    today = date.today()
    await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={
            "date": (today - timedelta(days=10)).isoformat(),
            "weight": 90.0,
        },
    )
    await client.post(
        f"{PREFIX}/users/me/weight",
        headers=user["headers"],
        json={"date": today.isoformat(), "weight": 89.0},
    )
    res = await client.get(
        f"{PREFIX}/users/me/weight/trend?days=30",
        headers=user["headers"],
    )
    assert res.status_code == 200
    body = res.json()
    assert body["entries"] == 2
    assert body["first_weight"] == 90.0
    assert body["last_weight"] == 89.0
    assert body["delta"] == -1.0


async def test_weight_endpoints_require_auth(client) -> None:
    for path in (
        f"{PREFIX}/users/me/weight",
        f"{PREFIX}/users/me/weight/trend",
    ):
        res = await client.get(path)
        assert res.status_code in (401, 403)
