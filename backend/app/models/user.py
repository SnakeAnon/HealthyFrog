import enum

from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    trainer = "trainer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)

    # Common profile fields
    name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    height = Column(Float, nullable=True)   # cm
    weight = Column(Float, nullable=True)   # kg
    goal = Column(String, nullable=True)

    # Trainer-specific fields
    bio = Column(String, nullable=True)
    specialty = Column(String, nullable=True)

    # User's assigned trainer
    trainer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    trainer = relationship("User", remote_side=[id], foreign_keys=[trainer_id], back_populates="clients")
    clients = relationship("User", back_populates="trainer", foreign_keys=[trainer_id])

    meals = relationship("Meal", back_populates="user")
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    received_messages = relationship("Message", back_populates="receiver", foreign_keys="Message.receiver_id")
    time_slots = relationship("TimeSlot", back_populates="trainer")
    bookings = relationship("Booking", back_populates="user")
