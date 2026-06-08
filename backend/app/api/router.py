from fastapi import APIRouter

from app.api import (
    admin,
    auth,
    booking,
    chat,
    meal_analysis,
    nutrition,
    reports,
    users,
    websocket,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(nutrition.router)
api_router.include_router(meal_analysis.router)
api_router.include_router(reports.router)
api_router.include_router(chat.router)
api_router.include_router(booking.router)
api_router.include_router(websocket.router)
