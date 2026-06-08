from typing import Optional
from datetime import datetime

from pydantic import BaseModel

from app.models.user import UserRole
from app.schemas.email_field import AppEmailStr


class UserProfile(BaseModel):
    id: int
    email: AppEmailStr
    name: Optional[str]
    role: UserRole
    age: Optional[int]
    height: Optional[float]
    weight: Optional[float]
    goal: Optional[str]
    bio: Optional[str]
    specialty: Optional[str]
    trainer_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    goal: Optional[str] = None
    bio: Optional[str] = None
    specialty: Optional[str] = None


class AdminUserUpdate(UserUpdate):

    role: Optional[UserRole] = None
    trainer_id: Optional[int] = None


class TrainerProfile(BaseModel):
    id: int
    email: AppEmailStr
    name: Optional[str]
    bio: Optional[str]
    specialty: Optional[str]

    model_config = {"from_attributes": True}
