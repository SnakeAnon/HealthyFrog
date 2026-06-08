from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_trainer
from app.models.user import User
from app.repositories.nutrition import NutritionRepository
from app.repositories.user import UserRepository
from app.schemas.nutrition import (
    DailyReport,
    PeriodReport,
    RangeReport,
    SummaryReport,
    WeeklyReport,
)
from app.services.nutrition import NutritionService

router = APIRouter(prefix="/reports", tags=["Reports"])


def _nutrition_service(db: AsyncSession) -> NutritionService:
    return NutritionService(NutritionRepository(db))


async def _ensure_client_of(
    db: AsyncSession, trainer: User, user_id: int
) -> User:
    repo = UserRepository(db)
    target = await repo.get_by_id(user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if target.trainer_id != trainer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a client of the current trainer",
        )
    return target


def _resolve_period(
    days: Optional[int],
    date_from: Optional[date],
    date_to: Optional[date],
    *,
    default_days: int = 7,
) -> tuple[date, date]:
    if days is not None and (date_from is not None or date_to is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use either `days` or `date_from`/`date_to`, not both",
        )
    if days is not None:
        if days <= 0 or days > 366:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="`days` must be between 1 and 366",
            )
        end = date.today()
        return end - timedelta(days=days - 1), end
    if date_from is not None and date_to is not None:
        if date_from > date_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from must be on or before date_to",
            )
        return date_from, date_to
    if date_from is not None or date_to is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both date_from and date_to must be provided together",
        )
    end = date.today()
    return end - timedelta(days=default_days - 1), end


# ---------------------------------------------------------------------- #
# Self-service reports.
# ---------------------------------------------------------------------- #


@router.get("/daily", response_model=DailyReport)
async def daily_report(
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_day = day or date.today()
    return await _nutrition_service(db).get_daily_report(
        current_user.id, target_day
    )


@router.get(
    "/weekly",
    response_model=WeeklyReport,
    summary="Weekly nutrition summary for the current user",
)
async def weekly_report_self(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklyReport:
    return await _nutrition_service(db).get_weekly_report(current_user.id)


@router.get(
    "/range",
    response_model=RangeReport,
    summary="Daily totals over an arbitrary date range (current user)",
)
async def range_report_self(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RangeReport:
    return await _nutrition_service(db).get_range_report(
        current_user.id, date_from, date_to
    )


@router.get(
    "/summary",
    response_model=SummaryReport,
    summary="Aggregated min/max/avg/total over a date range (current user)",
)
async def summary_report_self(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SummaryReport:
    return await _nutrition_service(db).get_summary_report(
        current_user.id, date_from, date_to
    )


# ---------------------------------------------------------------------- #
# Trainer-side reports.
# ---------------------------------------------------------------------- #


@router.get(
    "/users/{user_id}/nutrition",
    response_model=PeriodReport,
    summary="Nutrition of a client over a date range (trainer access)",
)
async def trainer_period_report(
    user_id: int,
    days: Optional[int] = Query(default=None, ge=1, le=366),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    trainer: User = Depends(require_trainer),
) -> PeriodReport:
    await _ensure_client_of(db, trainer, user_id)
    start, end = _resolve_period(days, date_from, date_to, default_days=7)
    return await _nutrition_service(db).get_period_report(user_id, start, end)


@router.get(
    "/users/{user_id}/weekly",
    response_model=WeeklyReport,
    summary="Weekly nutrition summary of a client (trainer access)",
)
async def trainer_weekly_report(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    trainer: User = Depends(require_trainer),
) -> WeeklyReport:
    await _ensure_client_of(db, trainer, user_id)
    return await _nutrition_service(db).get_weekly_report(user_id)
