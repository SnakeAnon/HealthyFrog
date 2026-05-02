from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.user


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
