from typing import Optional, List

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_ids(self, user_ids: List[int]) -> List[User]:
        if not user_ids:
            return []
        result = await self.db.execute(select(User).where(User.id.in_(user_ids)))
        return list(result.scalars().all())

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_trainers(self) -> List[User]:
        result = await self.db.execute(select(User).where(User.role == UserRole.trainer))
        return list(result.scalars().all())

    async def get_clients_of_trainer(self, trainer_id: int) -> List[User]:
        result = await self.db.execute(select(User).where(User.trainer_id == trainer_id))
        return list(result.scalars().all())

    async def list_filtered(
        self,
        *,
        role: Optional[UserRole] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[User]:
        stmt = select(User)
        if role is not None:
            stmt = stmt.where(User.role == role)
        if search:
            pattern = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    User.email.ilike(pattern),
                    User.name.ilike(pattern),
                )
            )
        stmt = stmt.order_by(User.id).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_role(self) -> dict[str, int]:
        from sqlalchemy import func

        stmt = select(User.role, func.count(User.id)).group_by(User.role)
        result = await self.db.execute(stmt)
        return {role.value if hasattr(role, "value") else str(role): n for role, n in result.all()}

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            setattr(user, key, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self.db.delete(user)
        await self.db.commit()
