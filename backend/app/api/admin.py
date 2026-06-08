"""Admin-only endpoints (user management + platform stats + audit)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User, UserRole
from app.repositories.user import UserRepository
from app.schemas.admin import AdminStatsResponse
from app.schemas.audit import AuditLogResponse
from app.schemas.user import AdminUserUpdate, UserProfile
from app.services import audit as audit_service
from app.services.admin import AdminService

router = APIRouter(prefix="/admin", tags=["Admin"])


def _service(db: AsyncSession) -> AdminService:
    return AdminService(db, UserRepository(db))


@router.get("/users", response_model=List[UserProfile])
async def list_users(
    role: Optional[UserRole] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> List[User]:
    return await _service(db).list_users(
        role=role, search=search, limit=limit, offset=offset
    )


@router.get("/users/{user_id}", response_model=UserProfile)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    return await _service(db).get_user(user_id)


@router.patch("/users/{user_id}", response_model=UserProfile)
async def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> User:
    updated = await _service(db).update_user(actor, user_id, data)
    await audit_service.log(
        db,
        user_id=actor.id,
        action="admin.user_update",
        entity_type="user",
        entity_id=user_id,
        payload=data.model_dump(exclude_none=True, mode="json"),
    )
    return updated


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
) -> Response:
    await _service(db).delete_user(actor, user_id)
    await audit_service.log(
        db,
        user_id=actor.id,
        action="admin.user_delete",
        entity_type="user",
        entity_id=user_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminStatsResponse:
    return await _service(db).get_stats()


@router.get("/audit", response_model=List[AuditLogResponse])
async def list_audit_log(
    user_id: Optional[int] = Query(default=None),
    action: Optional[str] = Query(default=None, max_length=100),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> List[AuditLogResponse]:
    rows = await audit_service.list_filtered(
        db,
        user_id=user_id,
        action=action,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return [AuditLogResponse.model_validate(r) for r in rows]
