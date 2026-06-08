from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository
from app.services.ai_client import AIClient
from app.services.auth import decode_token
from app.services.meal_analysis import MealAnalysisService

bearer_scheme = HTTPBearer()


async def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    payload = decode_token(credentials.credentials)
    jti: Optional[str] = payload.get("jti")
    if jti:
        repo = SessionRepository(db)
        session = await repo.get_by_jti(jti)
        if session is None or session.revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session is no longer active",
            )
        if session.expires_at and session.expires_at.replace(
            tzinfo=session.expires_at.tzinfo or timezone.utc
        ) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired",
            )
    return payload


async def get_current_user(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = int(payload.get("sub"))
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


async def require_trainer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.trainer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trainer access required",
        )
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def get_ai_client() -> AIClient:
    return AIClient()


def get_meal_analysis_service(
    ai: AIClient = Depends(get_ai_client),
) -> MealAnalysisService:
    return MealAnalysisService(ai)


def _client_metadata(request: Request) -> tuple[Optional[str], Optional[str]]:
    user_agent = request.headers.get("user-agent")
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else None)
    )
    return user_agent, ip
