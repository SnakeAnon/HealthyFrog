# Import all models so Alembic can discover them via Base.metadata
from app.models.user import User, UserRole
from app.models.nutrition import Product, Meal, MealItem, MealType
from app.models.chat import Message
from app.models.booking import TimeSlot, Booking, BookingStatus

__all__ = [
    "User",
    "UserRole",
    "Product",
    "Meal",
    "MealItem",
    "MealType",
    "Message",
    "TimeSlot",
    "Booking",
    "BookingStatus",
]
