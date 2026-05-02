from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, summary="Register a new account")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    service = AuthService(repo)
    _, token = await service.register(data.email, data.password, data.name, data.role)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse, summary="Login and get access token")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    service = AuthService(repo)
    _, token = await service.login(data.email, data.password)
    return TokenResponse(access_token=token)
