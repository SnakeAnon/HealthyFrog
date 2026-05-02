import enum

from sqlalchemy import Column, Integer, Enum, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    trainer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_available = Column(Boolean, default=True)

    trainer = relationship("User", back_populates="time_slots")
    booking = relationship("Booking", back_populates="slot", uselist=False)


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.pending)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    slot = relationship("TimeSlot", back_populates="booking")
    user = relationship("User", back_populates="bookings")
