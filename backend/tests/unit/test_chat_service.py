"""Unit tests for ``ChatService``.

Test level: **unit**.

Both repositories are mocked. These tests cover validation rules
(empty content, self-recipient, missing user), the trim-and-persist happy
path, the protective behaviour of ``get_conversation``/``mark_as_read``
and the empty-dialogs fast path.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.chat import Message
from app.models.user import User, UserRole
from app.services.chat import ChatService


def _user(id_: int = 2, name: str = "Receiver") -> User:
    return User(
        id=id_,
        email=f"u{id_}@example.com",
        hashed_password="x",
        role=UserRole.user,
        name=name,
    )


async def test_send_message_rejects_blank_content() -> None:
    service = ChatService(MagicMock(), MagicMock())
    with pytest.raises(HTTPException) as exc:
        await service.send_message(1, 2, "   ")
    assert exc.value.status_code == 400


async def test_send_message_rejects_self_recipient() -> None:
    service = ChatService(MagicMock(), MagicMock())
    with pytest.raises(HTTPException) as exc:
        await service.send_message(7, 7, "hi")
    assert exc.value.status_code == 400


async def test_send_message_requires_existing_recipient() -> None:
    user_repo = MagicMock()
    user_repo.get_by_id = AsyncMock(return_value=None)

    service = ChatService(MagicMock(), user_repo)
    with pytest.raises(HTTPException) as exc:
        await service.send_message(1, 999, "hi")
    assert exc.value.status_code == 404


async def test_send_message_trims_and_persists() -> None:
    saved = Message(
        id=1,
        sender_id=1,
        receiver_id=2,
        content="hi",
        is_read=False,
        created_at=datetime.utcnow(),
    )
    chat_repo = MagicMock()
    chat_repo.create_message = AsyncMock(return_value=saved)
    user_repo = MagicMock()
    user_repo.get_by_id = AsyncMock(return_value=_user())

    service = ChatService(chat_repo, user_repo)
    result = await service.send_message(1, 2, "  hi  ")

    assert result is saved
    chat_repo.create_message.assert_awaited_once_with(1, 2, "hi")


async def test_get_conversation_with_self_returns_empty() -> None:
    chat_repo = MagicMock()
    chat_repo.get_conversation = AsyncMock(return_value=[])
    service = ChatService(chat_repo, MagicMock())

    result = await service.get_conversation(5, 5)

    assert result == []
    chat_repo.get_conversation.assert_not_called()


async def test_mark_as_read_with_self_is_zero() -> None:
    chat_repo = MagicMock()
    chat_repo.mark_messages_read = AsyncMock(return_value=42)
    service = ChatService(chat_repo, MagicMock())

    assert await service.mark_as_read(7, 7) == 0
    chat_repo.mark_messages_read.assert_not_called()


async def test_mark_as_read_delegates_to_repository() -> None:
    chat_repo = MagicMock()
    chat_repo.mark_messages_read = AsyncMock(return_value=3)
    service = ChatService(chat_repo, MagicMock())

    assert await service.mark_as_read(reader_id=1, other_user_id=2) == 3
    chat_repo.mark_messages_read.assert_awaited_once_with(1, 2)


async def test_get_dialogs_returns_empty_list_when_no_messages() -> None:
    chat_repo = MagicMock()
    chat_repo.get_dialog_partners = AsyncMock(return_value=[])
    service = ChatService(chat_repo, MagicMock())

    assert await service.get_dialogs(1) == []


async def test_get_dialogs_assembles_partner_metadata() -> None:
    last_msg = Message(
        id=10,
        sender_id=2,
        receiver_id=1,
        content="hello",
        is_read=False,
        created_at=datetime.utcnow(),
    )
    chat_repo = MagicMock()
    chat_repo.get_dialog_partners = AsyncMock(
        return_value=[
            {"other_user_id": 2, "unread_count": 1, "last_message": last_msg}
        ]
    )
    user_repo = MagicMock()
    user_repo.get_by_ids = AsyncMock(return_value=[_user(id_=2, name="Coach")])

    service = ChatService(chat_repo, user_repo)
    dialogs = await service.get_dialogs(user_id=1)

    assert len(dialogs) == 1
    dialog = dialogs[0]
    assert dialog.other_user_id == 2
    assert dialog.other_user_name == "Coach"
    assert dialog.unread_count == 1
    assert dialog.last_message is not None
    assert dialog.last_message.content == "hello"
