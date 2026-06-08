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


# --------------------------------------------------------------------------- #
# Range / summary reports
# --------------------------------------------------------------------------- #


import pytest
from fastapi import HTTPException


async def test_range_report_pads_empty_days_with_zeros() -> None:
    repo = MagicMock()
    repo.get_meals_in_range = AsyncMock(
        return_value=[_meal_with(100, meal_id=1, meal_type=MealType.lunch)]
    )
    service = NutritionService(repo)

    report = await service.get_range_report(
        user_id=1, date_from=date(2024, 1, 1), date_to=date(2024, 1, 3)
    )

    assert report.period_start == date(2024, 1, 1)
    assert report.period_end == date(2024, 1, 3)
    assert len(report.days) == 3
    assert report.days[0].date == date(2024, 1, 1)
    assert report.days[0].total_calories == 100.0
    assert report.days[1].total_calories == 0.0
    assert report.days[2].total_calories == 0.0


async def test_range_report_inclusive_bounds() -> None:
    repo = MagicMock()
    repo.get_meals_in_range = AsyncMock(return_value=[])
    service = NutritionService(repo)

    report = await service.get_range_report(
        user_id=1, date_from=date(2024, 1, 1), date_to=date(2024, 1, 1)
    )
    assert len(report.days) == 1
    assert report.days[0].date == date(2024, 1, 1)


async def test_range_report_rejects_inverted_period() -> None:
    repo = MagicMock()
    repo.get_meals_in_range = AsyncMock(return_value=[])
    service = NutritionService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.get_range_report(
            user_id=1, date_from=date(2024, 1, 5), date_to=date(2024, 1, 1)
        )
    assert exc.value.status_code == 400


async def test_range_report_rejects_too_long_period() -> None:
    repo = MagicMock()
    repo.get_meals_in_range = AsyncMock(return_value=[])
    service = NutritionService(repo)

    with pytest.raises(HTTPException) as exc:
        await service.get_range_report(
            user_id=1,
            date_from=date(2024, 1, 1),
            date_to=date(2025, 1, 2),  # 367 days
        )
    assert exc.value.status_code == 400


async def test_summary_report_avg_min_max() -> None:
    repo = MagicMock()
    repo.get_meals_in_range = AsyncMock(
        return_value=[
            _meal_with(100, meal_id=1, meal_type=MealType.breakfast),
            _meal_with(200, meal_id=2, meal_type=MealType.lunch),
        ]
    )
    service = NutritionService(repo)

    summary = await service.get_summary_report(
        user_id=1, date_from=date(2024, 1, 1), date_to=date(2024, 1, 3)
    )
    assert summary.days_total == 3
    assert summary.days_logged == 1
    assert summary.total_calories == 300.0
    assert summary.avg_calories == 300.0
    assert summary.min_calories == 300.0
    assert summary.max_calories == 300.0


async def test_summary_report_zero_when_no_data() -> None:
    repo = MagicMock()
    repo.get_meals_in_range = AsyncMock(return_value=[])
    service = NutritionService(repo)

    summary = await service.get_summary_report(
        user_id=1, date_from=date(2024, 1, 1), date_to=date(2024, 1, 5)
    )
    assert summary.days_total == 5
    assert summary.days_logged == 0
    assert summary.total_calories == 0.0
    assert summary.avg_calories == 0.0
    assert summary.min_calories == 0.0
    assert summary.max_calories == 0.0
