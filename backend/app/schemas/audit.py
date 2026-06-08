from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    payload: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}
