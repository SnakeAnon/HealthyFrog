from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    receiver_id: int
    content: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class DialogResponse(BaseModel):
    other_user_id: int
    other_user_name: Optional[str] = None
    unread_count: int = 0
    last_message: Optional[MessageResponse] = None


class MarkReadResponse(BaseModel):
    marked: int
