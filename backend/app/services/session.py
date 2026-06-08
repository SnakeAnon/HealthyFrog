from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status

from app.models.session import UserSession
from app.repositories.session import SessionRepository
from app.services.auth import decode_token


class SessionService:
    def __init__(self, repo: SessionRepository):
        self.repo = repo

    @staticmethod
    def _exp_from_payload(payload: dict) -> datetime:
        exp = payload.get("exp")
        if not isinstance(exp, (int, float)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing exp claim",
            )
        return datetime.fromtimestamp(int(exp), tz=timezone.utc)

    async def register_token(
        self,
        token: str,
        *,
        user_agent: Optional[str] = None,
        ip: Optional[str] = None,
    ) -> UserSession:
        payload = decode_token(token)
        jti = payload.get("jti")
        sub = payload.get("sub")
        if not jti or not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing required claims",
            )
        return await self.repo.create(
            user_id=int(sub),
            jti=jti,
            expires_at=self._exp_from_payload(payload),
            user_agent=user_agent,
            ip=ip,
        )

    async def list_for_user(self, user_id: int) -> List[UserSession]:
        return await self.repo.list_active_for_user(user_id)

    async def revoke_jti(self, jti: str) -> None:
        await self.repo.revoke_by_jti(jti)

    async def revoke_all(self, user_id: int) -> int:
        return await self.repo.revoke_all_for_user(user_id)

    async def revoke_session_by_id(
        self, user_id: int, session_id: int
    ) -> None:
        target = await self.repo.get_by_id(session_id)
        if target is None or target.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        await self.repo.revoke_by_jti(target.jti)
