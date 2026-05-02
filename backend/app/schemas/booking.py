from datetime import datetime

from pydantic import BaseModel

from app.models.booking import BookingStatus


class TimeSlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime


class TimeSlotResponse(BaseModel):
    id: int
    trainer_id: int
    start_time: datetime
    end_time: datetime
    is_available: bool

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    slot_id: int


class BookingResponse(BaseModel):
    id: int
    slot_id: int
    user_id: int
    status: BookingStatus
    slot: TimeSlotResponse
    created_at: datetime

    model_config = {"from_attributes": True}


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
