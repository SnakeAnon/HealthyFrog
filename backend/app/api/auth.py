from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import _client_metadata, get_token_payload
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.session import RevokeResponse
from app.services import audit as audit_service
from app.services.auth import AuthService
from app.services.session import SessionService

router = APIRouter(prefix="/auth", tags=["Auth"])


def _session_service(db: AsyncSession) -> SessionService:
    return SessionService(SessionRepository(db))


@router.post(
    "/register", response_model=TokenResponse, summary="Register a new account"
)
async def register(
    data: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    service = AuthService(repo)
    user, token = await service.register(data.email, data.password, data.name, data.role)

    user_agent, ip = _client_metadata(request)
    await _session_service(db).register_token(
        token, user_agent=user_agent, ip=ip
    )
    await audit_service.log(
        db,
        user_id=user.id,
        action="user.register",
        entity_type="user",
        entity_id=user.id,
        payload={"email": data.email, "role": data.role.value},
    )
    return TokenResponse(access_token=token)


@router.post(
    "/login", response_model=TokenResponse, summary="Login and get access token"
)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    service = AuthService(repo)
    user, token = await service.login(data.email, data.password)

    user_agent, ip = _client_metadata(request)
    await _session_service(db).register_token(
        token, user_agent=user_agent, ip=ip
    )
    await audit_service.log(
        db,
        user_id=user.id,
        action="user.login",
        entity_type="user",
        entity_id=user.id,
    )
    return TokenResponse(access_token=token)


@router.post(
    "/logout",
    response_model=RevokeResponse,
    summary="Revoke the current access token",
)
async def logout(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
) -> RevokeResponse:
    jti = payload.get("jti")
    user_id = int(payload.get("sub")) if payload.get("sub") else None
    if jti:
        await _session_service(db).revoke_jti(jti)
        await audit_service.log(
            db, user_id=user_id, action="user.logout"
        )
        return RevokeResponse(revoked=1)
    return RevokeResponse(revoked=0)


@router.post(
    "/logout-all",
    response_model=RevokeResponse,
    summary="Revoke every active session of the current user",
)
async def logout_all(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
) -> RevokeResponse:
    user_id = int(payload.get("sub"))
    revoked = await _session_service(db).revoke_all(user_id)
    await audit_service.log(
        db,
        user_id=user_id,
        action="user.logout_all",
        payload={"revoked": revoked},
    )
    return RevokeResponse(revoked=revoked)
