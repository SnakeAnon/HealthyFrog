from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import TimeSlot, Booking, BookingStatus


class BookingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_trainer_slots(self, trainer_id: int) -> List[TimeSlot]:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(TimeSlot)
            .where(TimeSlot.trainer_id == trainer_id, TimeSlot.start_time > now)
            .order_by(TimeSlot.start_time)
        )
        return list(result.scalars().all())

    async def get_available_slots(self, trainer_id: int) -> List[TimeSlot]:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(TimeSlot)
            .where(
                TimeSlot.trainer_id == trainer_id,
                TimeSlot.is_available == True,
                TimeSlot.start_time > now,
            )
            .order_by(TimeSlot.start_time)
        )
        return list(result.scalars().all())

    async def get_slot_by_id(self, slot_id: int) -> Optional[TimeSlot]:
        result = await self.db.execute(select(TimeSlot).where(TimeSlot.id == slot_id))
        return result.scalar_one_or_none()

    async def create_slot(self, trainer_id: int, start_time, end_time) -> TimeSlot:
        slot = TimeSlot(trainer_id=trainer_id, start_time=start_time, end_time=end_time)
        self.db.add(slot)
        await self.db.commit()
        await self.db.refresh(slot)
        return slot

    async def get_user_bookings(self, user_id: int) -> List[Booking]:
        result = await self.db.execute(
            select(Booking)
            .where(Booking.user_id == user_id)
            .options(selectinload(Booking.slot))
            .order_by(Booking.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_trainer_bookings(self, trainer_id: int) -> List[Booking]:
        result = await self.db.execute(
            select(Booking)
            .join(TimeSlot)
            .where(TimeSlot.trainer_id == trainer_id)
            .options(selectinload(Booking.slot))
            .order_by(Booking.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_booking_by_id(self, booking_id: int) -> Optional[Booking]:
        result = await self.db.execute(
            select(Booking)
            .where(Booking.id == booking_id)
            .options(selectinload(Booking.slot))
        )
        return result.scalar_one_or_none()

    async def create_booking(self, slot_id: int, user_id: int) -> Booking:
        booking = Booking(slot_id=slot_id, user_id=user_id)
        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def update_booking_status(self, booking: Booking, status: BookingStatus) -> Booking:
        booking.status = status
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def mark_slot_unavailable(self, slot: TimeSlot) -> None:
        slot.is_available = False
        await self.db.commit()
