from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_meal_analysis_service
from app.models.user import User
from app.repositories.nutrition import NutritionRepository
from app.schemas.meal_analysis import (
    AnalysisConfirm,
    AnalysisResponse,
    TextAnalysisRequest,
    VoiceAnalysisResponse,
)
from app.schemas.nutrition import MealItemResponse
from app.services.meal_analysis import MealAnalysisService
from app.services.nutrition import NutritionService

router = APIRouter(prefix="/nutrition/analyze", tags=["Nutrition AI"])


@router.post(
    "/text",
    response_model=AnalysisResponse,
    summary="Estimate macros from a free-form description",
)
async def analyze_text(
    data: TextAnalysisRequest,
    service: MealAnalysisService = Depends(get_meal_analysis_service),
    _: User = Depends(get_current_user),
) -> AnalysisResponse:
    return await service.analyze_text(data.text)


@router.post(
    "/photo",
    response_model=AnalysisResponse,
    summary="Estimate macros from a meal photo",
)
async def analyze_photo(
    file: UploadFile = File(...),
    note: str | None = Form(None),
    service: MealAnalysisService = Depends(get_meal_analysis_service),
    _: User = Depends(get_current_user),
) -> AnalysisResponse:
    payload = await file.read()
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file upload",
        )
    return await service.analyze_photo(
        payload, file.content_type or "image/jpeg", hint=note or None
    )


@router.post(
    "/voice",
    response_model=VoiceAnalysisResponse,
    summary="Transcribe an audio note and estimate macros from the transcript",
)
async def analyze_voice(
    file: UploadFile = File(...),
    service: MealAnalysisService = Depends(get_meal_analysis_service),
    _: User = Depends(get_current_user),
) -> VoiceAnalysisResponse:
    payload = await file.read()
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file upload",
        )
    return await service.analyze_voice(
        payload, file.content_type or "audio/webm"
    )


@router.post(
    "/{meal_id}/confirm",
    response_model=MealItemResponse,
    status_code=201,
    summary="Persist a confirmed AI prediction inside an existing meal",
)
async def confirm_analysis(
    meal_id: int,
    data: AnalysisConfirm,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MealItemResponse:
    nutrition = NutritionService(NutritionRepository(db))
    return await nutrition.add_item_from_analysis(
        meal_id, current_user.id, data
    )
