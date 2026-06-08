from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, TimeSlot
from app.models.chat import Message
from app.models.nutrition import Meal, Product
from app.models.user import User, UserRole
from app.repositories.user import UserRepository
from app.schemas.admin import AdminStatsResponse
from app.schemas.user import AdminUserUpdate


class AdminService:
    def __init__(self, db: AsyncSession, user_repo: UserRepository):
        self.db = db
        self.user_repo = user_repo

    # ------------------------------------------------------------------ #
    # Users
    # ------------------------------------------------------------------ #

    async def list_users(
        self,
        *,
        role: Optional[UserRole] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[User]:
        return await self.user_repo.list_filtered(
            role=role, search=search, limit=limit, offset=offset
        )

    async def get_user(self, user_id: int) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return user

    async def update_user(
        self, actor: User, user_id: int, data: AdminUserUpdate
    ) -> User:
        target = await self.get_user(user_id)
        updates = data.model_dump(exclude_none=True)

        new_role = updates.get("role")
        if new_role is not None and target.id == actor.id and new_role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin cannot demote themselves",
            )

        new_trainer_id = updates.get("trainer_id")
        if new_trainer_id is not None:
            trainer = await self.user_repo.get_by_id(new_trainer_id)
            if not trainer or trainer.role != UserRole.trainer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="trainer_id must reference an existing trainer",
                )

        return await self.user_repo.update(target, **updates)

    async def delete_user(self, actor: User, user_id: int) -> None:
        if user_id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin cannot delete themselves",
            )
        target = await self.get_user(user_id)

        await self.db.execute(
            update(User)
            .where(User.trainer_id == target.id)
            .values(trainer_id=None)
        )
        await self.db.execute(
            update(Product)
            .where(Product.created_by == target.id)
            .values(created_by=None)
        )
        meals = (
            await self.db.execute(select(Meal).where(Meal.user_id == target.id))
        ).scalars().all()
        for meal in meals:
            await self.db.delete(meal)

        await self.db.execute(
            delete(Booking).where(Booking.user_id == target.id)
        )
        slot_ids = (
            await self.db.execute(
                select(TimeSlot.id).where(TimeSlot.trainer_id == target.id)
            )
        ).scalars().all()
        if slot_ids:
            await self.db.execute(
                delete(Booking).where(Booking.slot_id.in_(slot_ids))
            )
        await self.db.execute(
            delete(TimeSlot).where(TimeSlot.trainer_id == target.id)
        )
        await self.db.execute(
            delete(Message).where(
                (Message.sender_id == target.id)
                | (Message.receiver_id == target.id)
            )
        )

        await self.user_repo.delete(target)

    # ------------------------------------------------------------------ #
    # Stats
    # ------------------------------------------------------------------ #

    async def get_stats(self) -> AdminStatsResponse:
        total = await self.db.scalar(select(func.count(User.id)))
        users_by_role = await self.user_repo.count_by_role()
        products = await self.db.scalar(select(func.count(Product.id)))
        meals = await self.db.scalar(select(func.count(Meal.id)))
        messages = await self.db.scalar(select(func.count(Message.id)))
        bookings = await self.db.scalar(select(func.count(Booking.id)))
        return AdminStatsResponse(
            total_users=total or 0,
            users_by_role=users_by_role,
            products=products or 0,
            meals=meals or 0,
            messages=messages or 0,
            bookings=bookings or 0,
        )
