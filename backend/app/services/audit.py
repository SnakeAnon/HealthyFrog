from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.repositories.audit import AuditRepository

logger = logging.getLogger(__name__)


async def log(
    db: AsyncSession,
    *,
    user_id: Optional[int],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    payload: Optional[Any] = None,
) -> Optional[AuditLog]:
    try:
        return await AuditRepository(db).create(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
    except Exception as exc: 
        logger.warning(
            "audit.log failed for action=%s user_id=%s: %s",
            action,
            user_id,
            exc,
        )
        try:
            await db.rollback()
        except Exception: 
            pass
        return None


async def list_filtered(
    db: AsyncSession,
    *,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[AuditLog]:
    return await AuditRepository(db).list_filtered(
        user_id=user_id,
        action=action,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
