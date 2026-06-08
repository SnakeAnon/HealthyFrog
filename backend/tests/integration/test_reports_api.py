from __future__ import annotations

from datetime import date, timedelta

PREFIX = "/api/v1"


async def _create_meal_with_item(
    client, headers, *, day: str, product_id: int, grams: float = 100
) -> dict:
    meal = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=headers,
            json={"date": day, "meal_type": "lunch"},
        )
    ).json()
    await client.post(
        f"{PREFIX}/nutrition/meals/{meal['id']}/items",
        headers=headers,
        json={"product_id": product_id, "amount_grams": grams},
    )
    return meal


async def test_daily_report_requires_auth(client) -> None:
    res = await client.get(f"{PREFIX}/reports/daily")
    assert res.status_code in (401, 403)


async def test_daily_report_empty_day_returns_zeros(
    client, register_user
) -> None:
    user = await register_user(email="rep1@example.com")
    res = await client.get(
        f"{PREFIX}/reports/daily", headers=user["headers"]
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_calories"] == 0.0
    assert body["total_protein"] == 0.0
    assert body["total_fat"] == 0.0
    assert body["total_carbs"] == 0.0
    assert body["meals"] == []


async def test_daily_report_aggregates_meals(client, register_user) -> None:
    user = await register_user(email="rep2@example.com")
    today = date.today().isoformat()

    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Chicken",
                "calories_per_100g": 165,
                "protein_per_100g": 31,
                "fat_per_100g": 3.6,
                "carbs_per_100g": 0,
            },
        )
    ).json()

    breakfast = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=user["headers"],
            json={"date": today, "meal_type": "breakfast"},
        )
    ).json()
    lunch = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=user["headers"],
            json={"date": today, "meal_type": "lunch"},
        )
    ).json()

    await client.post(
        f"{PREFIX}/nutrition/meals/{breakfast['id']}/items",
        headers=user["headers"],
        json={"product_id": product["id"], "amount_grams": 100},
    )
    await client.post(
        f"{PREFIX}/nutrition/meals/{lunch['id']}/items",
        headers=user["headers"],
        json={"product_id": product["id"], "amount_grams": 200},
    )

    res = await client.get(
        f"{PREFIX}/reports/daily", headers=user["headers"]
    )
    assert res.status_code == 200, res.text
    body = res.json()
    # 300g of chicken → 495 cal / 93p / 10.8f / 0c (rounded to 2 dp).
    assert body["total_calories"] == 495.0
    assert body["total_protein"] == 93.0
    assert body["total_fat"] == 10.8
    assert body["total_carbs"] == 0.0
    assert len(body["meals"]) == 2


# ---------------------------------------------------------------------- #
# Weekly / period reports.
# ---------------------------------------------------------------------- #


async def test_weekly_self_report_for_empty_user(client, register_user) -> None:
    user = await register_user(email="weekly-empty@example.com")
    res = await client.get(
        f"{PREFIX}/reports/weekly", headers=user["headers"]
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_calories"] == 0.0
    assert body["days_with_data"] == 0
    assert len(body["days"]) == 7
    assert body["user_id"] == user["id"]
    assert body["summary"].startswith("0/7")


async def test_weekly_self_report_aggregates(client, register_user) -> None:
    user = await register_user(email="weekly@example.com")
    today = date.today()
    yesterday = today - timedelta(days=1)

    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Rice",
                "calories_per_100g": 130,
                "protein_per_100g": 2.7,
                "fat_per_100g": 0.3,
                "carbs_per_100g": 28,
            },
        )
    ).json()

    await _create_meal_with_item(
        client,
        user["headers"],
        day=today.isoformat(),
        product_id=product["id"],
        grams=200,
    )
    await _create_meal_with_item(
        client,
        user["headers"],
        day=yesterday.isoformat(),
        product_id=product["id"],
        grams=100,
    )

    res = await client.get(
        f"{PREFIX}/reports/weekly", headers=user["headers"]
    )
    assert res.status_code == 200, res.text
    body = res.json()
    # 200g + 100g rice → 390 cal total.
    assert body["total_calories"] == 390.0
    assert body["days_with_data"] == 2
    assert body["average_daily_calories"] == round(390.0 / 7, 2)
    assert len(body["days"]) == 7
    assert body["period_end"] == today.isoformat()


async def test_trainer_period_report_for_linked_client(
    client, register_user
) -> None:
    trainer = await register_user(email="rep-coach@example.com", role="trainer")
    user = await register_user(email="rep-user@example.com")

    await client.post(
        f"{PREFIX}/users/me/trainer/{trainer['id']}", headers=user["headers"]
    )

    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Protein bar",
                "calories_per_100g": 400,
                "protein_per_100g": 30,
                "fat_per_100g": 12,
                "carbs_per_100g": 40,
            },
        )
    ).json()

    today = date.today()
    await _create_meal_with_item(
        client,
        user["headers"],
        day=today.isoformat(),
        product_id=product["id"],
        grams=50,
    )

    res = await client.get(
        f"{PREFIX}/reports/users/{user['id']}/nutrition?days=7",
        headers=trainer["headers"],
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user_id"] == user["id"]
    assert body["total_calories"] == 200.0
    assert body["days_with_data"] == 1
    assert body["period_end"] == today.isoformat()


async def test_trainer_cannot_read_other_users_nutrition(
    client, register_user
) -> None:
    trainer = await register_user(email="t-blocked@example.com", role="trainer")
    other = await register_user(email="not-mine@example.com")

    res = await client.get(
        f"{PREFIX}/reports/users/{other['id']}/nutrition?days=7",
        headers=trainer["headers"],
    )
    assert res.status_code == 403


async def test_period_report_rejects_conflicting_query(
    client, register_user
) -> None:
    trainer = await register_user(email="t-q@example.com", role="trainer")
    user = await register_user(email="t-q-user@example.com")
    await client.post(
        f"{PREFIX}/users/me/trainer/{trainer['id']}", headers=user["headers"]
    )

    today = date.today().isoformat()
    res = await client.get(
        f"{PREFIX}/reports/users/{user['id']}/nutrition"
        f"?days=7&date_from={today}&date_to={today}",
        headers=trainer["headers"],
    )
    assert res.status_code == 400


async def test_user_role_cannot_use_trainer_report(client, register_user) -> None:
    user = await register_user(email="not-trainer@example.com")
    other = await register_user(email="another@example.com")
    res = await client.get(
        f"{PREFIX}/reports/users/{other['id']}/nutrition?days=7",
        headers=user["headers"],
    )
    assert res.status_code == 403


async def test_trainer_weekly_report_for_client(client, register_user) -> None:
    trainer = await register_user(email="t-w@example.com", role="trainer")
    user = await register_user(email="u-w@example.com")
    await client.post(
        f"{PREFIX}/users/me/trainer/{trainer['id']}", headers=user["headers"]
    )

    res = await client.get(
        f"{PREFIX}/reports/users/{user['id']}/weekly",
        headers=trainer["headers"],
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user_id"] == user["id"]
    assert len(body["days"]) == 7


# --------------------------------------------------------------------------- #
# /reports/range and /reports/summary
# --------------------------------------------------------------------------- #


async def test_range_report_requires_auth(client) -> None:
    today = date.today().isoformat()
    res = await client.get(f"{PREFIX}/reports/range?from={today}&to={today}")
    assert res.status_code in (401, 403)


async def test_range_report_pads_zeros_for_empty_days(
    client, register_user
) -> None:
    user = await register_user(email="r-range@example.com")
    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Generic",
                "calories_per_100g": 100,
                "protein_per_100g": 10,
                "fat_per_100g": 2,
                "carbs_per_100g": 15,
            },
        )
    ).json()

    today = date.today()
    await _create_meal_with_item(
        client,
        user["headers"],
        day=today.isoformat(),
        product_id=product["id"],
        grams=200,
    )

    date_from = (today - timedelta(days=4)).isoformat()
    res = await client.get(
        f"{PREFIX}/reports/range?from={date_from}&to={today.isoformat()}",
        headers=user["headers"],
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["period_start"] == date_from
    assert body["period_end"] == today.isoformat()
    assert len(body["days"]) == 5
    last = body["days"][-1]
    assert last["date"] == today.isoformat()
    assert last["total_calories"] == 200.0
    # Earlier days are zero-padded.
    earlier = [d["total_calories"] for d in body["days"][:-1]]
    assert all(c == 0.0 for c in earlier)


async def test_range_report_rejects_too_long_period(
    client, register_user
) -> None:
    user = await register_user(email="r-long@example.com")
    today = date.today()
    res = await client.get(
        f"{PREFIX}/reports/range",
        headers=user["headers"],
        params={
            "from": (today - timedelta(days=400)).isoformat(),
            "to": today.isoformat(),
        },
    )
    assert res.status_code == 400


async def test_summary_report_aggregates_period(
    client, register_user
) -> None:
    user = await register_user(email="r-sum@example.com")
    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Generic",
                "calories_per_100g": 100,
                "protein_per_100g": 10,
                "fat_per_100g": 2,
                "carbs_per_100g": 15,
            },
        )
    ).json()

    today = date.today()
    yesterday = today - timedelta(days=1)
    await _create_meal_with_item(
        client,
        user["headers"],
        day=yesterday.isoformat(),
        product_id=product["id"],
        grams=100,
    )
    await _create_meal_with_item(
        client,
        user["headers"],
        day=today.isoformat(),
        product_id=product["id"],
        grams=300,
    )

    res = await client.get(
        f"{PREFIX}/reports/summary",
        headers=user["headers"],
        params={
            "from": yesterday.isoformat(),
            "to": today.isoformat(),
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["days_total"] == 2
    assert body["days_logged"] == 2
    assert body["total_calories"] == 400.0
    assert body["min_calories"] == 100.0
    assert body["max_calories"] == 300.0
    assert body["avg_calories"] == 200.0


async def test_summary_report_returns_zeros_for_empty_period(
    client, register_user
) -> None:
    user = await register_user(email="r-zeros@example.com")
    today = date.today().isoformat()
    res = await client.get(
        f"{PREFIX}/reports/summary",
        headers=user["headers"],
        params={"from": today, "to": today},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["days_total"] == 1
    assert body["days_logged"] == 0
    assert body["total_calories"] == 0.0
    assert body["avg_calories"] == 0.0
