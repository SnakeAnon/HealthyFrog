from datetime import date

from fastapi import HTTPException, status

from app.repositories.nutrition import NutritionRepository
from app.schemas.nutrition import (
    ProductCreate,
    MealCreate,
    MealItemCreate,
    MealItemResponse,
    MealResponse,
    DailyReport,
    ProductResponse,
)


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
