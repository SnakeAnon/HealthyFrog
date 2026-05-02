from typing import List

from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Message


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_conversation(
        self, user1_id: int, user2_id: int, limit: int = 100
    ) -> List[Message]:
        result = await self.db.execute(
            select(Message)
            .where(
                or_(
                    and_(Message.sender_id == user1_id, Message.receiver_id == user2_id),
                    and_(Message.sender_id == user2_id, Message.receiver_id == user1_id),
                )
            )
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create_message(
        self, sender_id: int, receiver_id: int, content: str
    ) -> Message:
        message = Message(
            sender_id=sender_id, receiver_id=receiver_id, content=content
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def mark_messages_read(self, reader_id: int, sender_id: int) -> int:
        """Mark all incoming messages from sender_id to reader_id as read.
        Returns number of rows updated."""
        stmt = (
            update(Message)
            .where(
                Message.receiver_id == reader_id,
                Message.sender_id == sender_id,
                Message.is_read.is_(False),
            )
            .values(is_read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return int(result.rowcount or 0)

    async def get_dialog_partners(self, user_id: int) -> List[dict]:
        """Return one row per chat partner with last message metadata and unread count.

        Implemented as two aggregate queries to keep SQL portable and readable.
        """
        other_id_expr = case(
            (Message.sender_id == user_id, Message.receiver_id),
            else_=Message.sender_id,
        ).label("other_id")

        agg_stmt = (
            select(
                other_id_expr,
                func.max(Message.created_at).label("last_at"),
                func.sum(
                    case(
                        (
                            and_(
                                Message.receiver_id == user_id,
                                Message.is_read.is_(False),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("unread_count"),
            )
            .where(
                or_(Message.sender_id == user_id, Message.receiver_id == user_id)
            )
            .group_by("other_id")
            .order_by(func.max(Message.created_at).desc())
        )
        agg_rows = (await self.db.execute(agg_stmt)).all()
        if not agg_rows:
            return []

        last_msg_stmt = select(Message).where(
            or_(
                and_(
                    Message.sender_id == user_id,
                    Message.receiver_id.in_([r.other_id for r in agg_rows]),
                ),
                and_(
                    Message.receiver_id == user_id,
                    Message.sender_id.in_([r.other_id for r in agg_rows]),
                ),
            )
        )
        candidates = list((await self.db.execute(last_msg_stmt)).scalars().all())

        last_by_other: dict[int, Message] = {}
        for msg in candidates:
            other_id = (
                msg.receiver_id if msg.sender_id == user_id else msg.sender_id
            )
            current = last_by_other.get(other_id)
            # Tie-break by id so that two messages persisted in the same
            # microsecond (common in tests with fast SQLite inserts) yield
            # a deterministic "last" message.
            new_key = (msg.created_at, msg.id)
            if current is None or new_key > (current.created_at, current.id):
                last_by_other[other_id] = msg

        out: List[dict] = []
        for row in agg_rows:
            last_msg = last_by_other.get(row.other_id)
            out.append(
                {
                    "other_user_id": row.other_id,
                    "unread_count": int(row.unread_count or 0),
                    "last_message": last_msg,
                }
            )
        return out
