from __future__ import annotations

from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    total_users: int
    users_by_role: dict[str, int]
    products: int
    meals: int
    messages: int
    bookings: int
