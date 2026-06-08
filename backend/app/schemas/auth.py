from pydantic import BaseModel

from app.models.user import UserRole
from app.schemas.email_field import AppEmailStr


class RegisterRequest(BaseModel):
    email: AppEmailStr
    password: str
    name: str
    role: UserRole = UserRole.user


class LoginRequest(BaseModel):
    email: AppEmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
