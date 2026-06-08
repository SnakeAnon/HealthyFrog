from __future__ import annotations

import asyncio
import json
import logging
from enum import Enum
from typing import Optional

from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger(__name__)


class AIStage(str, Enum):

    CLASSIFY = "classify"
    READ_LABEL = "read_label"
    IDENTIFY_FOOD = "identify_food"
    ESTIMATE_WEIGHT = "estimate_weight"
    ESTIMATE_KBJU = "estimate_kbju"


_STAGE_TO_SETTING: dict[AIStage, str] = {
    AIStage.CLASSIFY: "GEMINI_API_CLASSIFY_KEY",
    AIStage.READ_LABEL: "GEMINI_API_READ_LABEL_KEY",
    AIStage.IDENTIFY_FOOD: "GEMINI_API_IDENTIFY_FOOD_KEY",
    AIStage.ESTIMATE_WEIGHT: "GEMINI_API_ESTIMATE_WEIGHT_KEY",
    AIStage.ESTIMATE_KBJU: "GEMINI_API_ESTIMATE_KBJU_KEY",
}


class AIClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        text_model: Optional[str] = None,
        vision_model: Optional[str] = None,
        audio_model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.AI_API_KEY
        self.text_model = text_model or settings.AI_MODEL
        self.vision_model = (
            vision_model or settings.AI_VISION_MODEL or self.text_model
        )
        self.audio_model = (
            audio_model or settings.AI_AUDIO_MODEL or self.text_model
        )

    # ------------------------------------------------------------------ #
    # Public API used by the service / pipeline layer.
    # ------------------------------------------------------------------ #

    async def generate_text(
        self,
        prompt: str,
        *,
        model: Optional[str] = None,
        stage: Optional[AIStage] = None,
    ) -> str:
        return await self._call(
            prompt=prompt, model=model or self.text_model, stage=stage
        )

    async def generate_with_image(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str,
        *,
        model: Optional[str] = None,
        stage: Optional[AIStage] = None,
    ) -> str:
        return await self._call(
            prompt=prompt,
            model=model or self.vision_model,
            image=(image_bytes, mime_type),
            stage=stage,
        )

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        mime_type: str,
        *,
        prompt: Optional[str] = None,
        model: Optional[str] = None,
        stage: Optional[AIStage] = None,
    ) -> str:
        instruction = prompt or (
            "Транскрибируй голосовое сообщение дословно на языке оригинала. "
            "Верни только текст транскрипции без дополнительных комментариев."
        )
        return await self._call(
            prompt=instruction,
            model=model or self.audio_model,
            audio=(audio_bytes, mime_type),
            stage=stage,
        )

    # ------------------------------------------------------------------ #
    # Helpers shared by every public method.
    # ------------------------------------------------------------------ #

    @staticmethod
    def parse_json_response(raw: str) -> dict:
        """Parse JSON from a model reply, accepting common fenced variants."""
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Nutrition AI returned an empty response",
            )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].lstrip()
            cleaned = cleaned.strip("`").strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.warning("AI returned non-JSON payload: %s", raw)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Nutrition AI returned a malformed response",
            ) from exc
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Nutrition AI response was not a JSON object",
            )
        return data

    def _resolve_key(self, stage: Optional[AIStage]) -> Optional[str]:
        """Pick the stage-specific Gemini key with fallback to AI_API_KEY."""
        if stage is not None:
            attr = _STAGE_TO_SETTING.get(stage)
            if attr:
                stage_key = getattr(settings, attr, None)
                if stage_key:
                    return stage_key
        return self.api_key

    def _openrouter_enabled(self) -> bool:
        key = getattr(settings, "OPENROUTER_API_KEY", None)
        return bool(key and str(key).strip())

    def _openrouter_sync_call(
        self,
        prompt: str,
        model: str,
        image: Optional[tuple[bytes, str]],
        audio: Optional[tuple[bytes, str]],
        api_key: str,
    ) -> str:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Install `openai` for OpenRouter support.",
            ) from exc

        headers: dict[str, str] = {"X-Title": settings.OPENROUTER_APP_TITLE}
        if settings.OPENROUTER_SITE_URL:
            headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL

        client = OpenAI(
            base_url=settings.OPENROUTER_BASE_URL,
            api_key=api_key,
            default_headers=headers,
        )

        if audio is not None:
            import io

            data, _mime = audio
            bio = io.BytesIO(data)
            bio.name = "audio.webm"
            try:
                tr = client.audio.transcriptions.create(
                    model=settings.OPENROUTER_TRANSCRIPTION_MODEL,
                    file=bio,
                )
            except Exception as exc:
                logger.warning("OpenRouter transcription failed: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        "Голосовое распознавание через OpenRouter недоступно. "
                        "Проверьте модель OPENROUTER_TRANSCRIPTION_MODEL или используйте текст/фото."
                    ),
                ) from exc
            text = getattr(tr, "text", None)
            if isinstance(text, str) and text.strip():
                return text.strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Транскрипция вернула пустой текст",
            )

        if image is not None:
            import base64

            raw, mime = image
            b64 = base64.standard_b64encode(raw).decode("ascii")
            data_uri = f"data:{mime};base64,{b64}"
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_uri}},
                    ],
                }
            ]
        else:
            messages = [{"role": "user", "content": prompt}]

        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
        )
        choice = resp.choices[0] if resp.choices else None
        msg = getattr(choice, "message", None) if choice else None
        content = getattr(msg, "content", None) if msg else None
        if isinstance(content, str) and content.strip():
            return content.strip()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nutrition AI returned an empty response",
        )

    async def _call(
        self,
        *,
        prompt: str,
        model: str,
        image: Optional[tuple[bytes, str]] = None,
        audio: Optional[tuple[bytes, str]] = None,
        stage: Optional[AIStage] = None,
    ) -> str:
        if self._openrouter_enabled():
            or_key = (settings.OPENROUTER_API_KEY or "").strip()
            try:
                return await asyncio.to_thread(
                    self._openrouter_sync_call,
                    prompt,
                    model,
                    image,
                    audio,
                    or_key,
                )
            except HTTPException:
                raise
            except Exception as exc:
                logger.exception("OpenRouter AI call failed: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Nutrition AI is unavailable: {exc}",
                ) from exc

        api_key = self._resolve_key(stage)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Nutrition AI is not configured. Set AI_API_KEY (or a "
                    "stage-specific GEMINI_API_*_KEY) in the backend "
                    "environment."
                ),
            )

        try:
            return await asyncio.to_thread(
                self._sync_call, prompt, model, image, audio, api_key
            )
        except HTTPException:
            raise
        except Exception as exc:  # network errors, SDK errors, parsing
            logger.exception("AI call failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nutrition AI is unavailable: {exc}",
            ) from exc

    def _sync_call(
        self,
        prompt: str,
        model: str,
        image: Optional[tuple[bytes, str]],
        audio: Optional[tuple[bytes, str]],
        api_key: str,
    ) -> str:
        try:
            from google import genai  # type: ignore[import-not-found]
            from google.genai import types  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - exercised in prod only
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Nutrition AI dependency missing. "
                    "Install `google-genai` in the backend image."
                ),
            ) from exc

        client = genai.Client(api_key=api_key)

        parts: list = [types.Part.from_text(text=prompt)]
        if image is not None:
            data, mime = image
            parts.append(types.Part.from_bytes(data=data, mime_type=mime))
        if audio is not None:
            data, mime = audio
            parts.append(types.Part.from_bytes(data=data, mime_type=mime))

        response = client.models.generate_content(model=model, contents=parts)

        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        candidates = getattr(response, "candidates", None) or []
        chunks: list[str] = []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            for part in getattr(content, "parts", None) or []:
                value = getattr(part, "text", None)
                if isinstance(value, str) and value.strip():
                    chunks.append(value.strip())
        if chunks:
            return "\n".join(chunks)

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nutrition AI returned an empty response",
        )
