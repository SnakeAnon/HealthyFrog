from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_trainer
from app.models.user import User
from app.repositories.booking import BookingRepository
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingStatusUpdate,
    TimeSlotCreate,
    TimeSlotResponse,
)
from app.services.booking import BookingService

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get("/slots/{trainer_id}", response_model=List[TimeSlotResponse])
async def get_available_slots(
    trainer_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.get_available_slots(trainer_id)


@router.get("/my-slots", response_model=List[TimeSlotResponse])
async def get_my_slots(
    current_user: User = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.get_trainer_slots(current_user.id)


@router.post("/slots", response_model=TimeSlotResponse, status_code=201)
async def create_slot(
    data: TimeSlotCreate,
    current_user: User = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.create_slot(current_user.id, data.start_time, data.end_time)


@router.post("/", response_model=BookingResponse, status_code=201)
async def book_slot(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.book_slot(data.slot_id, current_user.id)


@router.get("/my", response_model=List[BookingResponse])
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.get_user_bookings(current_user.id)


@router.get("/trainer-bookings", response_model=List[BookingResponse])
async def get_trainer_bookings(
    current_user: User = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.get_trainer_bookings(current_user.id)


@router.patch("/{booking_id}/status", response_model=BookingResponse)
async def update_booking_status(
    booking_id: int,
    data: BookingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = BookingRepository(db)
    service = BookingService(repo)
    return await service.update_status(booking_id, data.status, current_user.id)
