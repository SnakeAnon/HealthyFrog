from __future__ import annotations

from datetime import date as DateType
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metrics import WeightLog


class WeightLogRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_for_date(
        self, user_id: int, date: DateType
    ) -> Optional[WeightLog]:
        stmt = select(WeightLog).where(
            WeightLog.user_id == user_id, WeightLog.date == date
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_for_date(
        self, user_id: int, date: DateType, weight: float
    ) -> WeightLog:
        existing = await self.get_for_date(user_id, date)
        if existing:
            existing.weight = weight
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        log = WeightLog(user_id=user_id, date=date, weight=weight)
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def get_range(
        self,
        user_id: int,
        date_from: DateType,
        date_to: DateType,
    ) -> List[WeightLog]:
        stmt = (
            select(WeightLog)
            .where(
                WeightLog.user_id == user_id,
                WeightLog.date >= date_from,
                WeightLog.date <= date_to,
            )
            .order_by(WeightLog.date)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_latest(self, user_id: int, n: int) -> List[WeightLog]:
        stmt = (
            select(WeightLog)
            .where(WeightLog.user_id == user_id)
            .order_by(WeightLog.date.desc())
            .limit(n)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
