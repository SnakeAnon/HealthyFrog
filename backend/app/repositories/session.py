from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import UserSession


class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: int,
        jti: str,
        expires_at: datetime,
        user_agent: Optional[str] = None,
        ip: Optional[str] = None,
    ) -> UserSession:
        session = UserSession(
            user_id=user_id,
            jti=jti,
            expires_at=expires_at,
            user_agent=user_agent,
            ip=ip,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_by_jti(self, jti: str) -> Optional[UserSession]:
        result = await self.db.execute(
            select(UserSession).where(UserSession.jti == jti)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, session_id: int) -> Optional[UserSession]:
        result = await self.db.execute(
            select(UserSession).where(UserSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def list_active_for_user(self, user_id: int) -> List[UserSession]:
        stmt = (
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.revoked.is_(False),
            )
            .order_by(UserSession.created_at.desc())
        )
        result = await self.db.execute(stmt)
        rows = list(result.scalars().all())
        now = datetime.now(timezone.utc)
        active: List[UserSession] = []
        for row in rows:
            exp = row.expires_at
            if exp is None:
                active.append(row)
                continue
            exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
            if exp_aware > now:
                active.append(row)
        return active

    async def revoke_by_jti(self, jti: str) -> None:
        await self.db.execute(
            update(UserSession)
            .where(UserSession.jti == jti)
            .values(revoked=True)
        )
        await self.db.commit()

    async def revoke_all_for_user(self, user_id: int) -> int:
        stmt = (
            update(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.revoked.is_(False),
            )
            .values(revoked=True)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount or 0

    async def touch_last_seen(self, jti: str) -> None:
        await self.db.execute(
            update(UserSession)
            .where(UserSession.jti == jti)
            .values(last_seen_at=datetime.now())
        )
        await self.db.commit()
