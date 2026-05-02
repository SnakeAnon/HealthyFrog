from datetime import date
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.nutrition import Product, Meal, MealItem


class NutritionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_products(self, search: Optional[str] = None) -> List[Product]:
        query = select(Product)
        if search:
            query = query.where(Product.name.ilike(f"%{search}%"))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_product_by_id(self, product_id: int) -> Optional[Product]:
        result = await self.db.execute(select(Product).where(Product.id == product_id))
        return result.scalar_one_or_none()

    async def create_product(self, **kwargs) -> Product:
        product = Product(**kwargs)
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def get_meals_by_date(self, user_id: int, meal_date: date) -> List[Meal]:
        result = await self.db.execute(
            select(Meal)
            .where(Meal.user_id == user_id, Meal.date == meal_date)
            .options(selectinload(Meal.items).selectinload(MealItem.product))
            .order_by(Meal.created_at)
        )
        return list(result.scalars().all())

    async def get_meal_by_id(self, meal_id: int) -> Optional[Meal]:
        result = await self.db.execute(
            select(Meal)
            .where(Meal.id == meal_id)
            .options(selectinload(Meal.items).selectinload(MealItem.product))
        )
        return result.scalar_one_or_none()

    async def create_meal(self, **kwargs) -> Meal:
        meal = Meal(**kwargs)
        self.db.add(meal)
        await self.db.commit()
        await self.db.refresh(meal)
        return meal

    async def add_meal_item(self, meal_id: int, product_id: int, amount_grams: float) -> MealItem:
        item = MealItem(meal_id=meal_id, product_id=product_id, amount_grams=amount_grams)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete_meal(self, meal: Meal) -> None:
        await self.db.delete(meal)
        await self.db.commit()
