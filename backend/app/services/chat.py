from typing import List

from fastapi import HTTPException, status

from app.models.chat import Message
from app.repositories.chat import ChatRepository
from app.repositories.user import UserRepository
from app.schemas.chat import DialogResponse, MessageResponse


class ChatService:
    """Business logic for messaging.

    Holds both repositories so dialog summaries can be assembled with
    partner names without leaking SQL details into the API layer.
    """

    def __init__(self, chat_repo: ChatRepository, user_repo: UserRepository):
        self.chat_repo = chat_repo
        self.user_repo = user_repo

    async def get_conversation(
        self, current_user_id: int, other_user_id: int, limit: int = 100
    ) -> List[Message]:
        if current_user_id == other_user_id:
            return []
        return await self.chat_repo.get_conversation(
            current_user_id, other_user_id, limit
        )

    async def send_message(
        self, sender_id: int, receiver_id: int, content: str
    ) -> Message:
        text = (content or "").strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message content is empty",
            )
        if sender_id == receiver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send a message to yourself",
            )
        receiver = await self.user_repo.get_by_id(receiver_id)
        if not receiver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receiver not found",
            )
        return await self.chat_repo.create_message(sender_id, receiver_id, text)

    async def mark_as_read(self, reader_id: int, other_user_id: int) -> int:
        if reader_id == other_user_id:
            return 0
        return await self.chat_repo.mark_messages_read(reader_id, other_user_id)

    async def get_dialogs(self, user_id: int) -> List[DialogResponse]:
        rows = await self.chat_repo.get_dialog_partners(user_id)
        if not rows:
            return []

        partner_ids = [r["other_user_id"] for r in rows]
        partners = await self.user_repo.get_by_ids(partner_ids)
        by_id = {u.id: u for u in partners}

        dialogs: List[DialogResponse] = []
        for row in rows:
            last_msg = row["last_message"]
            partner = by_id.get(row["other_user_id"])
            dialogs.append(
                DialogResponse(
                    other_user_id=row["other_user_id"],
                    other_user_name=partner.name if partner else None,
                    unread_count=row["unread_count"],
                    last_message=(
                        MessageResponse.model_validate(last_msg)
                        if last_msg is not None
                        else None
                    ),
                )
            )
        return dialogs
