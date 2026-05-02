"""Unit tests for the daily report aggregation logic.

Test level: **unit**.

The reports endpoint reuses ``NutritionService.get_daily_report``; these
tests pin its behaviour for the empty-day edge case and the multi-meal
aggregation path without touching the database.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.nutrition import Meal, MealItem, MealType, Product
from app.services.nutrition import NutritionService


def _product() -> Product:
    return Product(
        id=1,
        name="Generic",
        calories_per_100g=100,
        protein_per_100g=10,
        fat_per_100g=2,
        carbs_per_100g=15,
    )


def _meal_with(amount: float, *, meal_id: int, meal_type: MealType) -> Meal:
    meal = Meal(
        id=meal_id,
        user_id=1,
        date=date(2024, 1, 1),
        meal_type=meal_type,
        name=None,
        created_at=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc),
    )
    item = MealItem(
        id=meal_id,
        meal_id=meal_id,
        product_id=1,
        amount_grams=amount,
    )
    item.product = _product()
    meal.items = [item]
    return meal


async def test_daily_report_empty_day_returns_zeros() -> None:
    repo = MagicMock()
    repo.get_meals_by_date = AsyncMock(return_value=[])

    service = NutritionService(repo)
    report = await service.get_daily_report(user_id=1, day=date(2024, 1, 1))

    assert report.total_calories == 0.0
    assert report.total_protein == 0.0
    assert report.total_fat == 0.0
    assert report.total_carbs == 0.0
    assert report.meals == []


async def test_daily_report_sums_multiple_meals() -> None:
    repo = MagicMock()
    repo.get_meals_by_date = AsyncMock(
        return_value=[
            _meal_with(100, meal_id=1, meal_type=MealType.breakfast),
            _meal_with(200, meal_id=2, meal_type=MealType.lunch),
        ]
    )
    service = NutritionService(repo)

    report = await service.get_daily_report(user_id=1, day=date(2024, 1, 1))

    # 100g + 200g of (100/10/2/15 per 100g) → 300 / 30 / 6 / 45
    assert report.total_calories == 300.0
    assert report.total_protein == 30.0
    assert report.total_fat == 6.0
    assert report.total_carbs == 45.0
    assert len(report.meals) == 2


async def test_daily_report_passes_user_id_through() -> None:
    repo = MagicMock()
    repo.get_meals_by_date = AsyncMock(return_value=[])
    service = NutritionService(repo)

    await service.get_daily_report(user_id=42, day=date(2024, 5, 17))

    repo.get_meals_by_date.assert_awaited_once_with(42, date(2024, 5, 17))
