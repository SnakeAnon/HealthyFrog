from datetime import date as DateType
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_trainer
from app.models.user import User
from app.repositories.metrics import WeightLogRepository
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository
from app.schemas.audit import AuditLogResponse
from app.schemas.metrics import (
    WeightLogCreate,
    WeightLogResponse,
    WeightTrendResponse,
)
from app.schemas.session import SessionResponse
from app.schemas.user import TrainerProfile, UserProfile, UserUpdate
from app.services import audit as audit_service
from app.services.metrics import WeightService
from app.services.session import SessionService
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["Users"])


def _service(db: AsyncSession) -> UserService:
    return UserService(UserRepository(db))


def _weight_service(db: AsyncSession) -> WeightService:
    return WeightService(WeightLogRepository(db), UserRepository(db))


def _session_service(db: AsyncSession) -> SessionService:
    return SessionService(SessionRepository(db))


@router.get("/me", response_model=UserProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserProfile)
async def update_my_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await _service(db).update_profile(current_user, data)
    await audit_service.log(
        db,
        user_id=current_user.id,
        action="user.profile_update",
        entity_type="user",
        entity_id=current_user.id,
        payload=data.model_dump(exclude_none=True),
    )
    return updated


@router.get("/trainers", response_model=List[TrainerProfile])
async def list_trainers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _service(db).get_trainers()


@router.get("/trainers/{trainer_id}", response_model=TrainerProfile)
async def get_trainer(
    trainer_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _service(db).get_trainer_or_404(trainer_id)


@router.post("/me/trainer/{trainer_id}", response_model=UserProfile)
async def assign_trainer(
    trainer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await _service(db).assign_trainer(current_user, trainer_id)
    await audit_service.log(
        db,
        user_id=current_user.id,
        action="user.assign_trainer",
        entity_type="user",
        entity_id=current_user.id,
        payload={"trainer_id": trainer_id},
    )
    return updated


@router.get("/my-clients", response_model=List[UserProfile])
async def get_my_clients(
    current_user: User = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    return await _service(db).get_clients(current_user.id)


# ─── metrics ─────────────────────────────────────────────────────────── #


@router.post("/me/weight", response_model=WeightLogResponse)
async def record_weight(
    data: WeightLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightLogResponse:
    log = await _weight_service(db).record_weight(
        current_user.id, data.date, data.weight
    )
    return WeightLogResponse.model_validate(log)


@router.get("/me/weight", response_model=List[WeightLogResponse])
async def get_weight_history(
    date_from: Optional[DateType] = Query(default=None, alias="from"),
    date_to: Optional[DateType] = Query(default=None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[WeightLogResponse]:
    logs = await _weight_service(db).get_history(
        current_user.id, date_from, date_to
    )
    return [WeightLogResponse.model_validate(log) for log in logs]


@router.get("/me/weight/trend", response_model=WeightTrendResponse)
async def get_weight_trend(
    days: int = Query(default=30, ge=1, le=3650),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightTrendResponse:
    return await _weight_service(db).get_trend(current_user.id, days)


# ─── sessions ────────────────────────────────────────────────────────── #


@router.get("/me/sessions", response_model=List[SessionResponse])
async def list_my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[SessionResponse]:
    sessions = await _session_service(db).list_for_user(current_user.id)
    return [SessionResponse.model_validate(s) for s in sessions]


@router.delete(
    "/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_my_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _session_service(db).revoke_session_by_id(
        current_user.id, session_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── audit ───────────────────────────────────────────────────────────── #


@router.get("/me/audit", response_model=List[AuditLogResponse])
async def list_my_audit(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[AuditLogResponse]:
    rows = await audit_service.list_filtered(
        db, user_id=current_user.id, limit=limit, offset=offset
    )
    return [AuditLogResponse.model_validate(r) for r in rows]
