from __future__ import annotations

from datetime import date as DateType, datetime
from typing import Optional

from pydantic import BaseModel, Field


class WeightLogCreate(BaseModel):
    date: DateType
    weight: float = Field(gt=0, le=500, description="Body weight in kilograms")


class WeightLogResponse(BaseModel):
    id: int
    date: DateType
    weight: float
    recorded_at: datetime

    model_config = {"from_attributes": True}


class WeightTrendResponse(BaseModel):
    days: int
    entries: int
    first_weight: Optional[float] = None
    last_weight: Optional[float] = None
    delta: Optional[float] = None
    avg_change_per_day: Optional[float] = None
