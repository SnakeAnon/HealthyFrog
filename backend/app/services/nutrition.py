from datetime import date, timedelta
from typing import List

from fastapi import HTTPException, status

from app.repositories.nutrition import NutritionRepository
from app.schemas.meal_analysis import AnalysisConfirm
from app.schemas.nutrition import (
    DailyReport,
    DailySummary,
    DailyTotals,
    MealCreate,
    MealItemCreate,
    MealItemResponse,
    MealResponse,
    PeriodReport,
    ProductCreate,
    ProductResponse,
    RangeReport,
    SummaryReport,
    WeeklyReport,
)


_MAX_PERIOD_DAYS = 366


def _compute_item_nutrition(item) -> dict:
    factor = item.amount_grams / 100
    return {
        "calories": round(item.product.calories_per_100g * factor, 2),
        "protein": round(item.product.protein_per_100g * factor, 2),
        "fat": round(item.product.fat_per_100g * factor, 2),
        "carbs": round(item.product.carbs_per_100g * factor, 2),
    }


def _build_meal_response(meal) -> MealResponse:
    items = []
    total_calories = total_protein = total_fat = total_carbs = 0.0

    for item in meal.items:
        nutr = _compute_item_nutrition(item)
        items.append(
            MealItemResponse(
                id=item.id,
                product_id=item.product_id,
                product=ProductResponse.model_validate(item.product),
                amount_grams=item.amount_grams,
                **nutr,
            )
        )
        total_calories += nutr["calories"]
        total_protein += nutr["protein"]
        total_fat += nutr["fat"]
        total_carbs += nutr["carbs"]

    return MealResponse(
        id=meal.id,
        user_id=meal.user_id,
        date=meal.date,
        meal_type=meal.meal_type,
        name=meal.name,
        items=items,
        total_calories=round(total_calories, 2),
        total_protein=round(total_protein, 2),
        total_fat=round(total_fat, 2),
        total_carbs=round(total_carbs, 2),
        created_at=meal.created_at,
    )


class NutritionService:
    def __init__(self, repo: NutritionRepository):
        self.repo = repo

    async def get_products(self, search: str = None):
        return await self.repo.get_products(search)

    async def create_product(self, data: ProductCreate, user_id: int):
        return await self.repo.create_product(**data.model_dump(), created_by=user_id)

    async def create_meal(self, user_id: int, data: MealCreate) -> MealResponse:
        meal = await self.repo.create_meal(user_id=user_id, **data.model_dump())
        return MealResponse(
            id=meal.id,
            user_id=meal.user_id,
            date=meal.date,
            meal_type=meal.meal_type,
            name=meal.name,
            items=[],
            total_calories=0.0,
            total_protein=0.0,
            total_fat=0.0,
            total_carbs=0.0,
            created_at=meal.created_at,
        )

    async def add_meal_item(self, meal_id: int, user_id: int, data: MealItemCreate) -> MealItemResponse:
        meal = await self.repo.get_meal_by_id(meal_id)
        if not meal or meal.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found")

        product = await self.repo.get_product_by_id(data.product_id)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        item = await self.repo.add_meal_item(meal_id, data.product_id, data.amount_grams)
        factor = data.amount_grams / 100

        return MealItemResponse(
            id=item.id,
            product_id=item.product_id,
            product=ProductResponse.model_validate(product),
            amount_grams=item.amount_grams,
            calories=round(product.calories_per_100g * factor, 2),
            protein=round(product.protein_per_100g * factor, 2),
            fat=round(product.fat_per_100g * factor, 2),
            carbs=round(product.carbs_per_100g * factor, 2),
        )

    async def get_daily_meals(self, user_id: int, day: date):
        meals = await self.repo.get_meals_by_date(user_id, day)
        return [_build_meal_response(m) for m in meals]

    async def get_daily_report(self, user_id: int, day: date) -> DailyReport:
        meals = await self.repo.get_meals_by_date(user_id, day)
        meal_responses = [_build_meal_response(m) for m in meals]

        return DailyReport(
            date=day,
            total_calories=round(sum(m.total_calories for m in meal_responses), 2),
            total_protein=round(sum(m.total_protein for m in meal_responses), 2),
            total_fat=round(sum(m.total_fat for m in meal_responses), 2),
            total_carbs=round(sum(m.total_carbs for m in meal_responses), 2),
            meals=meal_responses,
        )

    # ------------------------------------------------------------------ #
    # AI-confirmation flow.
    # ------------------------------------------------------------------ #

    async def add_item_from_analysis(
        self,
        meal_id: int,
        user_id: int,
        data: AnalysisConfirm,
    ) -> MealItemResponse:
        """Persist a confirmed AI prediction as a Product + MealItem pair.

        The portion macros sent by the client are the totals for the
        whole portion (``estimated_weight`` grams). They are converted to
        per-100g values for the ad-hoc Product so that the rest of the
        nutrition module keeps using the same data shape.
        """
        meal = await self.repo.get_meal_by_id(meal_id)
        if not meal or meal.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meal not found",
            )

        if data.estimated_weight <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="estimated_weight must be greater than zero",
            )
        factor = 100.0 / data.estimated_weight
        product = await self.repo.create_product(
            name=data.dish_name,
            calories_per_100g=round(data.calories * factor, 2),
            protein_per_100g=round(data.proteins * factor, 2),
            fat_per_100g=round(data.fats * factor, 2),
            carbs_per_100g=round(data.carbs * factor, 2),
            created_by=user_id,
        )
        item = await self.repo.add_meal_item(
            meal.id, product.id, data.estimated_weight
        )
        return MealItemResponse(
            id=item.id,
            product_id=product.id,
            product=ProductResponse.model_validate(product),
            amount_grams=item.amount_grams,
            calories=round(data.calories, 2),
            protein=round(data.proteins, 2),
            fat=round(data.fats, 2),
            carbs=round(data.carbs, 2),
        )

    # ------------------------------------------------------------------ #
    # Period and weekly reports (used by trainer and self-views).
    # ------------------------------------------------------------------ #

    async def get_period_report(
        self, user_id: int, date_from: date, date_to: date
    ) -> PeriodReport:
        if date_from > date_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from must be on or before date_to",
            )
        meals = await self.repo.get_meals_in_range(user_id, date_from, date_to)
        meal_responses = [_build_meal_response(m) for m in meals]

        days = _bucket_meals_by_day(meal_responses, date_from, date_to)
        total_days = len(days)
        days_with_data = sum(1 for d in days if d.meals)
        total_calories = round(sum(d.total_calories for d in days), 2)
        total_protein = round(sum(d.total_protein for d in days), 2)
        total_fat = round(sum(d.total_fat for d in days), 2)
        total_carbs = round(sum(d.total_carbs for d in days), 2)
        avg = (
            round(total_calories / total_days, 2) if total_days else 0.0
        )

        return PeriodReport(
            user_id=user_id,
            period_start=date_from,
            period_end=date_to,
            total_calories=total_calories,
            total_proteins=total_protein,
            total_fats=total_fat,
            total_carbs=total_carbs,
            average_daily_calories=avg,
            days_with_data=days_with_data,
            days=days,
        )

    async def get_weekly_report(
        self, user_id: int, end_day: date | None = None
    ) -> WeeklyReport:
        end = end_day or date.today()
        start = end - timedelta(days=6)
        period = await self.get_period_report(user_id, start, end)
        summary = (
            f"{period.days_with_data}/7 days logged, "
            f"avg {period.average_daily_calories:.0f} kcal/day."
        )
        return WeeklyReport(**period.model_dump(), summary=summary)

    # ------------------------------------------------------------------ #
    # Range / summary reports (per-day totals over an arbitrary period).
    # ------------------------------------------------------------------ #

    def _validate_period(self, date_from: date, date_to: date) -> None:
        if date_from > date_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from must be on or before date_to",
            )
        span = (date_to - date_from).days + 1
        if span > _MAX_PERIOD_DAYS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Period must not exceed {_MAX_PERIOD_DAYS} days",
            )

    async def _per_day_totals(
        self, user_id: int, date_from: date, date_to: date
    ) -> List[DailyTotals]:
        meals = await self.repo.get_meals_in_range(user_id, date_from, date_to)
        meal_responses = [_build_meal_response(m) for m in meals]
        days = _bucket_meals_by_day(meal_responses, date_from, date_to)
        return [
            DailyTotals(
                date=d.date,
                total_calories=d.total_calories,
                total_protein=d.total_protein,
                total_fat=d.total_fat,
                total_carbs=d.total_carbs,
            )
            for d in days
        ]

    async def get_range_report(
        self, user_id: int, date_from: date, date_to: date
    ) -> RangeReport:
        self._validate_period(date_from, date_to)
        days = await self._per_day_totals(user_id, date_from, date_to)
        return RangeReport(
            period_start=date_from, period_end=date_to, days=days
        )

    async def get_summary_report(
        self, user_id: int, date_from: date, date_to: date
    ) -> SummaryReport:
        self._validate_period(date_from, date_to)
        days = await self._per_day_totals(user_id, date_from, date_to)
        days_total = len(days)
        logged = [d for d in days if d.total_calories > 0]
        days_logged = len(logged)

        def _sum(attr: str) -> float:
            return round(sum(getattr(d, attr) for d in days), 2)

        total_calories = _sum("total_calories")
        total_protein = _sum("total_protein")
        total_fat = _sum("total_fat")
        total_carbs = _sum("total_carbs")

        if days_logged:
            avg_cal = round(total_calories / days_logged, 2)
            avg_prot = round(total_protein / days_logged, 2)
            avg_fat = round(total_fat / days_logged, 2)
            avg_carbs = round(total_carbs / days_logged, 2)
            min_cal = round(min(d.total_calories for d in logged), 2)
            max_cal = round(max(d.total_calories for d in logged), 2)
        else:
            avg_cal = avg_prot = avg_fat = avg_carbs = 0.0
            min_cal = max_cal = 0.0

        return SummaryReport(
            period_start=date_from,
            period_end=date_to,
            days_total=days_total,
            days_logged=days_logged,
            total_calories=total_calories,
            total_protein=total_protein,
            total_fat=total_fat,
            total_carbs=total_carbs,
            avg_calories=avg_cal,
            avg_protein=avg_prot,
            avg_fat=avg_fat,
            avg_carbs=avg_carbs,
            min_calories=min_cal,
            max_calories=max_cal,
        )


def _bucket_meals_by_day(
    meals: List[MealResponse],
    date_from: date,
    date_to: date,
) -> List[DailySummary]:
    by_day: dict[date, List[MealResponse]] = {}
    for meal in meals:
        by_day.setdefault(meal.date, []).append(meal)

    days: List[DailySummary] = []
    cursor = date_from
    while cursor <= date_to:
        day_meals = by_day.get(cursor, [])
        days.append(
            DailySummary(
                date=cursor,
                total_calories=round(
                    sum(m.total_calories for m in day_meals), 2
                ),
                total_protein=round(
                    sum(m.total_protein for m in day_meals), 2
                ),
                total_fat=round(sum(m.total_fat for m in day_meals), 2),
                total_carbs=round(sum(m.total_carbs for m in day_meals), 2),
                meals=day_meals,
            )
        )
        cursor += timedelta(days=1)
    return days
