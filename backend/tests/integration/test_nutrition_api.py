from __future__ import annotations

from datetime import date

PREFIX = "/api/v1"


async def test_products_listing_requires_auth(client) -> None:
    res = await client.get(f"{PREFIX}/nutrition/products")
    assert res.status_code in (401, 403)


async def test_create_and_list_product(client, register_user) -> None:
    user = await register_user(email="p1@example.com")

    create = await client.post(
        f"{PREFIX}/nutrition/products",
        headers=user["headers"],
        json={
            "name": "Apple",
            "calories_per_100g": 52,
            "protein_per_100g": 0.3,
            "fat_per_100g": 0.2,
            "carbs_per_100g": 14.0,
        },
    )
    assert create.status_code == 201, create.text
    product = create.json()
    assert product["name"] == "Apple"
    assert product["id"]

    listing = await client.get(
        f"{PREFIX}/nutrition/products", headers=user["headers"]
    )
    assert listing.status_code == 200
    names = [p["name"] for p in listing.json()]
    assert "Apple" in names


async def test_create_meal_and_add_item_calculates_macros(
    client, register_user
) -> None:
    user = await register_user(email="p2@example.com")
    today = date.today().isoformat()

    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Oatmeal",
                "calories_per_100g": 380,
                "protein_per_100g": 13,
                "fat_per_100g": 7,
                "carbs_per_100g": 67,
            },
        )
    ).json()

    meal = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=user["headers"],
            json={"date": today, "meal_type": "breakfast", "name": "Breakfast"},
        )
    ).json()

    add = await client.post(
        f"{PREFIX}/nutrition/meals/{meal['id']}/items",
        headers=user["headers"],
        json={"product_id": product["id"], "amount_grams": 50},
    )
    assert add.status_code == 201, add.text
    item = add.json()
    # 50g of (380/13/7/67 per 100g) → 190 / 6.5 / 3.5 / 33.5
    assert item["calories"] == 190.0
    assert item["protein"] == 6.5
    assert item["fat"] == 3.5
    assert item["carbs"] == 33.5


async def test_get_meals_returns_only_current_user_data(
    client, register_user
) -> None:
    me = await register_user(email="me@example.com")
    other = await register_user(email="other@example.com")
    today = date.today().isoformat()

    await client.post(
        f"{PREFIX}/nutrition/meals",
        headers=other["headers"],
        json={"date": today, "meal_type": "lunch"},
    )

    listing = await client.get(
        f"{PREFIX}/nutrition/meals", headers=me["headers"]
    )
    assert listing.status_code == 200
    assert listing.json() == []


async def test_add_item_to_foreign_meal_is_forbidden(
    client, register_user
) -> None:
    owner = await register_user(email="owner@example.com")
    intruder = await register_user(email="intruder@example.com")
    today = date.today().isoformat()

    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=owner["headers"],
            json={"name": "Egg", "calories_per_100g": 155},
        )
    ).json()
    meal = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=owner["headers"],
            json={"date": today, "meal_type": "lunch"},
        )
    ).json()

    res = await client.post(
        f"{PREFIX}/nutrition/meals/{meal['id']}/items",
        headers=intruder["headers"],
        json={"product_id": product["id"], "amount_grams": 100},
    )
    assert res.status_code == 404
