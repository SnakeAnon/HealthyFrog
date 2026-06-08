from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.nutrition import Meal, MealItem, MealType, Product
from app.schemas.nutrition import MealCreate, MealItemCreate, ProductCreate
from app.services.nutrition import NutritionService


def _product(
    id_: int = 1,
    name: str = "Apple",
    cal: float = 52,
    p: float = 0.3,
    f: float = 0.2,
    c: float = 14.0,
) -> Product:
    return Product(
        id=id_,
        name=name,
        calories_per_100g=cal,
        protein_per_100g=p,
        fat_per_100g=f,
        carbs_per_100g=c,
    )


def _meal(user_id: int = 7, items=None) -> Meal:
    meal = Meal(
        id=1,
        user_id=user_id,
        date=date(2024, 1, 1),
        meal_type=MealType.lunch,
        name=None,
        created_at=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc),
    )
    meal.items = list(items or [])
    return meal


async def test_create_product_records_owner() -> None:
    repo = MagicMock()
    repo.create_product = AsyncMock(return_value=_product())
    service = NutritionService(repo)

    await service.create_product(
        ProductCreate(name="Apple", calories_per_100g=52), user_id=99
    )

    repo.create_product.assert_awaited_once()
    kwargs = repo.create_product.await_args.kwargs
    assert kwargs.get("created_by") == 99
    assert kwargs.get("name") == "Apple"


async def test_create_meal_returns_response_with_zero_totals() -> None:
    saved = _meal()
    repo = MagicMock()
    repo.create_meal = AsyncMock(return_value=saved)
    service = NutritionService(repo)

    result = await service.create_meal(
        user_id=7, data=MealCreate(date=date(2024, 1, 1), meal_type=MealType.lunch)
    )

    assert result.id == saved.id
    assert result.user_id == 7
    assert result.items == []
    assert result.total_calories == 0.0
    assert result.total_protein == 0.0


async def test_add_meal_item_calculates_macros() -> None:
    product = _product(cal=200, p=10, f=5, c=20)
    meal = _meal()

    repo = MagicMock()
    repo.get_meal_by_id = AsyncMock(return_value=meal)
    repo.get_product_by_id = AsyncMock(return_value=product)
    repo.add_meal_item = AsyncMock(
        return_value=MealItem(id=10, meal_id=1, product_id=1, amount_grams=150)
    )

    service = NutritionService(repo)
    response = await service.add_meal_item(
        meal_id=1,
        user_id=7,
        data=MealItemCreate(product_id=1, amount_grams=150),
    )

    factor = 150 / 100
    assert response.calories == round(200 * factor, 2)
    assert response.protein == round(10 * factor, 2)
    assert response.fat == round(5 * factor, 2)
    assert response.carbs == round(20 * factor, 2)


async def test_add_meal_item_rejects_foreign_meal() -> None:
    repo = MagicMock()
    repo.get_meal_by_id = AsyncMock(return_value=_meal(user_id=7))
    service = NutritionService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.add_meal_item(
            meal_id=1,
            user_id=999,  # not the meal's owner
            data=MealItemCreate(product_id=1, amount_grams=100),
        )
    assert exc.value.status_code == 404


async def test_add_meal_item_rejects_missing_product() -> None:
    repo = MagicMock()
    repo.get_meal_by_id = AsyncMock(return_value=_meal())
    repo.get_product_by_id = AsyncMock(return_value=None)
    service = NutritionService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.add_meal_item(
            meal_id=1,
            user_id=7,
            data=MealItemCreate(product_id=999, amount_grams=100),
        )
    assert exc.value.status_code == 404


async def test_get_daily_meals_aggregates_totals() -> None:
    product_a = _product(id_=1, cal=100, p=10, f=2, c=15)
    product_b = _product(id_=2, cal=200, p=5, f=20, c=10)

    item_a = MealItem(id=1, meal_id=1, product_id=1, amount_grams=200)
    item_a.product = product_a
    item_b = MealItem(id=2, meal_id=1, product_id=2, amount_grams=50)
    item_b.product = product_b

    meal = _meal(items=[item_a, item_b])

    repo = MagicMock()
    repo.get_meals_by_date = AsyncMock(return_value=[meal])
    service = NutritionService(repo)

    result = await service.get_daily_meals(user_id=7, day=date(2024, 1, 1))

    assert len(result) == 1
    summary = result[0]
    # 200g of A → 200 cal / 20p / 4f / 30c
    # 50g of B  → 100 cal /  2.5p / 10f / 5c
    assert summary.total_calories == 300.0
    assert summary.total_protein == 22.5
    assert summary.total_fat == 14.0
    assert summary.total_carbs == 35.0
