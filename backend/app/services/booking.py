from fastapi import HTTPException, status

from app.models.booking import BookingStatus
from app.repositories.booking import BookingRepository


class BookingService:
    def __init__(self, repo: BookingRepository):
        self.repo = repo

    async def create_slot(self, trainer_id: int, start_time, end_time):
        return await self.repo.create_slot(trainer_id, start_time, end_time)

    async def get_trainer_slots(self, trainer_id: int):
        return await self.repo.get_trainer_slots(trainer_id)

    async def get_available_slots(self, trainer_id: int):
        return await self.repo.get_available_slots(trainer_id)

    async def book_slot(self, slot_id: int, user_id: int):
        slot = await self.repo.get_slot_by_id(slot_id)
        if not slot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")
        if not slot.is_available:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slot is no longer available")

        booking = await self.repo.create_booking(slot_id, user_id)
        await self.repo.mark_slot_unavailable(slot)
        return await self.repo.get_booking_by_id(booking.id)

    async def get_user_bookings(self, user_id: int):
        return await self.repo.get_user_bookings(user_id)

    async def get_trainer_bookings(self, trainer_id: int):
        return await self.repo.get_trainer_bookings(trainer_id)

    async def update_status(self, booking_id: int, new_status: BookingStatus, current_user_id: int):
        booking = await self.repo.get_booking_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        if booking.user_id != current_user_id and booking.slot.trainer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        return await self.repo.update_booking_status(booking, new_status)
