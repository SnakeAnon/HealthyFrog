from typing import Optional, List
from datetime import date, datetime

from pydantic import BaseModel

from app.models.nutrition import MealType


class ProductCreate(BaseModel):
    name: str
    calories_per_100g: float
    protein_per_100g: float = 0.0
    fat_per_100g: float = 0.0
    carbs_per_100g: float = 0.0


class ProductResponse(BaseModel):
    id: int
    name: str
    calories_per_100g: float
    protein_per_100g: float
    fat_per_100g: float
    carbs_per_100g: float

    model_config = {"from_attributes": True}


class MealItemCreate(BaseModel):
    product_id: int
    amount_grams: float


class MealItemResponse(BaseModel):
    id: int
    product_id: int
    product: ProductResponse
    amount_grams: float
    calories: float
    protein: float
    fat: float
    carbs: float

    model_config = {"from_attributes": True}


class MealCreate(BaseModel):
    date: date
    meal_type: MealType
    name: Optional[str] = None


class MealResponse(BaseModel):
    id: int
    user_id: int
    date: date
    meal_type: MealType
    name: Optional[str]
    items: List[MealItemResponse] = []
    total_calories: float
    total_protein: float
    total_fat: float
    total_carbs: float
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyReport(BaseModel):
    date: date
    total_calories: float
    total_protein: float
    total_fat: float
    total_carbs: float
    meals: List[MealResponse]


class DailySummary(BaseModel):
    """One day inside a period or weekly report."""

    date: date
    total_calories: float
    total_protein: float
    total_fat: float
    total_carbs: float
    meals: List[MealResponse]


class PeriodReport(BaseModel):
    """Aggregated nutrition for a single user across a date range."""

    user_id: int
    period_start: date
    period_end: date
    total_calories: float
    total_proteins: float
    total_fats: float
    total_carbs: float
    average_daily_calories: float
    days_with_data: int
    days: List[DailySummary]


class WeeklyReport(PeriodReport):
    """Period report covering the last 7 days plus a textual summary."""

    summary: Optional[str] = None


class DailyTotals(BaseModel):
    """One day's total macros (without the meals breakdown)."""

    date: date
    total_calories: float
    total_protein: float
    total_fat: float
    total_carbs: float


class RangeReport(BaseModel):
    period_start: date
    period_end: date
    days: List[DailyTotals]


class SummaryReport(BaseModel):
    """Aggregated min/max/avg/total over a date range."""

    period_start: date
    period_end: date
    days_total: int
    days_logged: int
    total_calories: float
    total_protein: float
    total_fat: float
    total_carbs: float
    avg_calories: float
    avg_protein: float
    avg_fat: float
    avg_carbs: float
    min_calories: float
    max_calories: float
