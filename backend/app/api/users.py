from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_trainer
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import TrainerProfile, UserProfile, UserUpdate
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["Users"])


def _service(db: AsyncSession) -> UserService:
    return UserService(UserRepository(db))


@router.get("/me", response_model=UserProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserProfile)
async def update_my_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _service(db).update_profile(current_user, data)


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
    return await _service(db).assign_trainer(current_user, trainer_id)


@router.get("/my-clients", response_model=List[UserProfile])
async def get_my_clients(
    current_user: User = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    return await _service(db).get_clients(current_user.id)
