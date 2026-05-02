from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.nutrition import NutritionRepository
from app.schemas.nutrition import DailyReport
from app.services.nutrition import NutritionService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily", response_model=DailyReport)
async def daily_report(
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_day = day or date.today()
    repo = NutritionRepository(db)
    service = NutritionService(repo)
    return await service.get_daily_report(current_user.id, target_day)
