from __future__ import annotations

from fastapi import HTTPException, status

from app.schemas.meal_analysis import (
    AnalysisResponse,
    VoiceAnalysisResponse,
)
from app.services.ai_client import AIClient
from app.services.nutrition_pipeline import (
    PipelineResult,
    run_photo_pipeline,
    run_text_pipeline,
)


_CONFIDENCE_BY_SOURCE = {
    "label": 0.9,
    "label_fallback": 0.7,
    "model": 0.6,
}


_NOTES_BY_SOURCE = {
    "label": "Источник КБЖУ: этикетка",
    "label_fallback": "Источник КБЖУ: этикетка нечитаема → модель",
    "model": "Источник КБЖУ: модель",
}


def _to_response(result: PipelineResult) -> AnalysisResponse:
    # Take only the first non-empty line as a short display name
    lines = [ln.strip() for ln in result.dish_description.splitlines() if ln.strip()]
    dish_name = lines[0] if lines else ""
    # Strip common "label:" prefixes the model might accidentally add
    for prefix in ("Название:", "NAME:", "НАЗВАНИЕ:", "Блюдо:"):
        if dish_name.lower().startswith(prefix.lower()):
            dish_name = dish_name[len(prefix):].strip()
    if not dish_name:
        dish_name = "Упакованный продукт по этикетке"
    return AnalysisResponse(
        dish_name=dish_name,
        ingredients=[],
        estimated_weight=round(result.weight_g, 2),
        calories=round(result.kbju_total.k, 2),
        proteins=round(result.kbju_total.b, 2),
        fats=round(result.kbju_total.j, 2),
        carbs=round(result.kbju_total.u, 2),
        confidence=_CONFIDENCE_BY_SOURCE.get(result.kbju_source),
        notes=_NOTES_BY_SOURCE.get(result.kbju_source, result.kbju_source),
    )


class MealAnalysisService:

    def __init__(self, ai: AIClient):
        self.ai = ai

    async def analyze_text(self, text: str) -> AnalysisResponse:
        result = await run_text_pipeline(self.ai, text)
        return _to_response(result)

    async def analyze_photo(
        self, image_bytes: bytes, mime_type: str, *, hint: str | None = None
    ) -> AnalysisResponse:
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image upload",
            )
        if not mime_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image",
            )
        result = await run_photo_pipeline(self.ai, image_bytes, mime_type, hint=hint)
        return _to_response(result)

    async def analyze_voice(
        self, audio_bytes: bytes, mime_type: str
    ) -> VoiceAnalysisResponse:
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio upload",
            )
        if not mime_type.startswith("audio/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be audio",
            )
        transcript = (
            await self.ai.transcribe_audio(audio_bytes, mime_type)
        ).strip()
        if not transcript:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Transcription returned an empty result",
            )
        analysis = await self.analyze_text(transcript)
        return VoiceAnalysisResponse(
            transcribed_text=transcript, **analysis.model_dump()
        )
