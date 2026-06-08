from __future__ import annotations

from datetime import date as DateType, timedelta
from typing import List, Optional

from fastapi import HTTPException, status

from app.models.metrics import WeightLog
from app.repositories.metrics import WeightLogRepository
from app.repositories.user import UserRepository
from app.schemas.metrics import WeightTrendResponse


class WeightService:
    def __init__(
        self,
        weight_repo: WeightLogRepository,
        user_repo: UserRepository,
    ):
        self.weight_repo = weight_repo
        self.user_repo = user_repo

    async def record_weight(
        self, user_id: int, date: DateType, weight: float
    ) -> WeightLog:
        if weight <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="weight must be positive",
            )
        # Allow +1 day buffer to handle clients in UTC+ timezones
        if date > DateType.today() + timedelta(days=1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date cannot be more than 1 day in the future",
            )

        log = await self.weight_repo.upsert_for_date(user_id, date, weight)

        latest = await self.weight_repo.get_latest(user_id, 1)
        if latest:
            user = await self.user_repo.get_by_id(user_id)
            if user is not None and user.weight != latest[0].weight:
                await self.user_repo.update(user, weight=latest[0].weight)
        return log

    async def get_history(
        self,
        user_id: int,
        date_from: Optional[DateType],
        date_to: Optional[DateType],
    ) -> List[WeightLog]:
        if date_from is None:
            date_from = DateType.today() - timedelta(days=30)
        if date_to is None:
            date_to = DateType.today()
        if date_from > date_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from must be earlier than or equal to date_to",
            )
        return await self.weight_repo.get_range(user_id, date_from, date_to)

    async def get_trend(
        self, user_id: int, days: int = 30
    ) -> WeightTrendResponse:
        if days <= 0 or days > 3650:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="days must be between 1 and 3650",
            )
        date_to = DateType.today()
        date_from = date_to - timedelta(days=days - 1)
        logs = await self.weight_repo.get_range(user_id, date_from, date_to)
        if not logs:
            return WeightTrendResponse(days=days, entries=0)
        first, last = logs[0], logs[-1]
        delta = round(last.weight - first.weight, 2)
        span_days = max((last.date - first.date).days, 0)
        avg_per_day = round(delta / span_days, 3) if span_days else 0.0
        return WeightTrendResponse(
            days=days,
            entries=len(logs),
            first_weight=first.weight,
            last_weight=last.weight,
            delta=delta,
            avg_change_per_day=avg_per_day,
        )
