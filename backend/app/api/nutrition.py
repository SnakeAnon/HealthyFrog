from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.nutrition import NutritionRepository
from app.schemas.nutrition import (
    MealCreate,
    MealItemCreate,
    MealItemResponse,
    MealResponse,
    ProductCreate,
    ProductResponse,
)
from app.services import audit as audit_service
from app.services.nutrition import NutritionService

router = APIRouter(prefix="/nutrition", tags=["Nutrition"])


def _service(db: AsyncSession) -> NutritionService:
    return NutritionService(NutritionRepository(db))


@router.get("/products", response_model=List[ProductResponse])
async def list_products(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _service(db).get_products(search)


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _service(db).create_product(data, current_user.id)


@router.get("/meals", response_model=List[MealResponse])
async def get_meals(
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_day = day or date.today()
    return await _service(db).get_daily_meals(current_user.id, target_day)


@router.post("/meals", response_model=MealResponse, status_code=201)
async def create_meal(
    data: MealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = await _service(db).create_meal(current_user.id, data)
    await audit_service.log(
        db,
        user_id=current_user.id,
        action="meal.create",
        entity_type="meal",
        entity_id=meal.id,
        payload={
            "date": data.date.isoformat(),
            "meal_type": data.meal_type.value,
        },
    )
    return meal


@router.post("/meals/{meal_id}/items", response_model=MealItemResponse, status_code=201)
async def add_meal_item(
    meal_id: int,
    data: MealItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _service(db).add_meal_item(meal_id, current_user.id, data)
