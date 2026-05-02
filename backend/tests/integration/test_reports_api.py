"""Integration tests for the daily report endpoint.

Test level: **integration**.

Verifies that the report sums macros across multiple meals for the
authenticated user and returns zeroes for an empty day.
"""

from __future__ import annotations

from datetime import date

PREFIX = "/api/v1"


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
