from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SessionResponse(BaseModel):
    id: int
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    user_agent: Optional[str] = None
    ip: Optional[str] = None
    revoked: bool

    model_config = {"from_attributes": True}


class RevokeResponse(BaseModel):
    revoked: int
