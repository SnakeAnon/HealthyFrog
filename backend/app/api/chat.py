from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.chat import ChatRepository
from app.repositories.user import UserRepository
from app.schemas.chat import (
    DialogResponse,
    MarkReadResponse,
    MessageCreate,
    MessageResponse,
)
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["Chat"])


def _service(db: AsyncSession) -> ChatService:
    return ChatService(ChatRepository(db), UserRepository(db))


@router.get(
    "/dialogs",
    response_model=List[DialogResponse],
    summary="List dialogs of the current user",
)
async def list_dialogs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _service(db).get_dialogs(current_user.id)


@router.get(
    "/{other_user_id}",
    response_model=List[MessageResponse],
    summary="Get conversation with a given user",
)
async def get_conversation(
    other_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _service(db).get_conversation(current_user.id, other_user_id)


@router.post(
    "/",
    response_model=MessageResponse,
    status_code=201,
    summary="Send a message via REST",
)
async def send_message(
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _service(db).send_message(
        current_user.id, data.receiver_id, data.content
    )


@router.post(
    "/{other_user_id}/read",
    response_model=MarkReadResponse,
    summary="Mark all incoming messages from a user as read",
)
async def mark_conversation_read(
    other_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    marked = await _service(db).mark_as_read(current_user.id, other_user_id)
    return MarkReadResponse(marked=marked)
