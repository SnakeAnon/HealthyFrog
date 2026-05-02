from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.repositories.user import UserRepository
from app.schemas.user import UserUpdate


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def get_profile(self, user_id: int) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        updates = data.model_dump(exclude_none=True)
        return await self.user_repo.update(user, **updates)

    async def get_trainers(self):
        return await self.user_repo.get_trainers()

    async def get_trainer_or_404(self, trainer_id: int) -> User:
        trainer = await self.user_repo.get_by_id(trainer_id)
        if not trainer or trainer.role != UserRole.trainer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")
        return trainer

    async def assign_trainer(self, user: User, trainer_id: int) -> User:
        trainer = await self.get_trainer_or_404(trainer_id)
        return await self.user_repo.update(user, trainer_id=trainer.id)

    async def get_clients(self, trainer_id: int):
        return await self.user_repo.get_clients_of_trainer(trainer_id)
