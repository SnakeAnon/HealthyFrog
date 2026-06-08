# Import all models so Alembic can discover them via Base.metadata
from app.models.user import User, UserRole
from app.models.nutrition import Product, Meal, MealItem, MealType
from app.models.chat import Message
from app.models.booking import TimeSlot, Booking, BookingStatus
from app.models.metrics import WeightLog
from app.models.session import UserSession
from app.models.audit import AuditLog

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
    "WeightLog",
    "UserSession",
    "AuditLog",
]
