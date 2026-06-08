from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class TextAnalysisRequest(BaseModel):
    text: str = Field(min_length=2, max_length=2000)


class IngredientItem(BaseModel):
    name: str
    amount_grams: Optional[float] = None


class AnalysisResponse(BaseModel):

    dish_name: str
    ingredients: List[IngredientItem] = []
    estimated_weight: float = Field(
        ge=0, description="Estimated portion weight in grams"
    )
    calories: float = Field(ge=0)
    proteins: float = Field(ge=0)
    fats: float = Field(ge=0)
    carbs: float = Field(ge=0)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    notes: Optional[str] = None


class VoiceAnalysisResponse(AnalysisResponse):

    transcribed_text: str


class AnalysisConfirm(BaseModel):

    dish_name: str = Field(min_length=1, max_length=200)
    estimated_weight: float = Field(gt=0, le=10_000)
    calories: float = Field(ge=0)
    proteins: float = Field(ge=0)
    fats: float = Field(ge=0)
    carbs: float = Field(ge=0)
