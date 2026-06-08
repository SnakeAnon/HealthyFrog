from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services.ai_client import AIClient, AIStage
from app.services.meal_analysis import MealAnalysisService


class FakeAI(AIClient):

    def __init__(
        self,
        *,
        replies: dict[AIStage, str] | None = None,
        audio_reply: str = "",
    ) -> None:
        super().__init__(api_key="fake")
        self.replies: dict[AIStage, str] = replies or {}
        self.audio_reply = audio_reply
        self.calls: list[tuple[str, AIStage | None]] = []

    def _reply_for(self, stage: AIStage | None) -> str:
        if stage is None:
            return ""
        try:
            return self.replies[stage]
        except KeyError as exc:
            raise AssertionError(
                f"FakeAI got an unexpected stage: {stage}"
            ) from exc

    async def generate_text(
        self,
        prompt: str,
        *,
        model: str | None = None,
        stage: AIStage | None = None,
    ) -> str:
        self.calls.append(("text", stage))
        return self._reply_for(stage)

    async def generate_with_image(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str,
        *,
        model: str | None = None,
        stage: AIStage | None = None,
    ) -> str:
        self.calls.append(("image", stage))
        return self._reply_for(stage)

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        mime_type: str,
        *,
        prompt: str | None = None,
        model: str | None = None,
        stage: AIStage | None = None,
    ) -> str:
        self.calls.append(("audio", stage))
        return self.audio_reply


_KBJU_REPLY = "K=140; B=5; J=4; U=20"
_WEIGHT_REPLY = "WEIGHT_G=250"
_DISH_REPLY = "Овсянка с ягодами. Каша на воде с черникой и малиной."


# --------------------------------------------------------------------------- #
# Text pipeline
# --------------------------------------------------------------------------- #


async def test_analyze_text_runs_identify_then_kbju_and_weight() -> None:
    ai = FakeAI(
        replies={
            AIStage.IDENTIFY_FOOD: _DISH_REPLY,
            AIStage.ESTIMATE_KBJU: _KBJU_REPLY,
            AIStage.ESTIMATE_WEIGHT: _WEIGHT_REPLY,
        }
    )
    service = MealAnalysisService(ai)

    result = await service.analyze_text("овсянка с ягодами, ~250г")

    assert result.dish_name.startswith("Овсянка")
    # 250g portion of (140 kcal / 5p / 4f / 20c) per 100g.
    assert result.estimated_weight == 250.0
    assert result.calories == pytest.approx(350.0)
    assert result.proteins == pytest.approx(12.5)
    assert result.fats == pytest.approx(10.0)
    assert result.carbs == pytest.approx(50.0)

    stages = [stage for _, stage in ai.calls]
    assert AIStage.IDENTIFY_FOOD in stages
    assert AIStage.ESTIMATE_KBJU in stages
    assert AIStage.ESTIMATE_WEIGHT in stages


async def test_analyze_text_rejects_blank_input() -> None:
    service = MealAnalysisService(FakeAI())
    with pytest.raises(HTTPException) as exc:
        await service.analyze_text("   ")
    assert exc.value.status_code == 400


async def test_analyze_text_502_on_unparseable_kbju() -> None:
    ai = FakeAI(
        replies={
            AIStage.IDENTIFY_FOOD: _DISH_REPLY,
            AIStage.ESTIMATE_KBJU: "completely off-format reply",
            AIStage.ESTIMATE_WEIGHT: _WEIGHT_REPLY,
        }
    )
    service = MealAnalysisService(ai)
    with pytest.raises(HTTPException) as exc:
        await service.analyze_text("anything")
    assert exc.value.status_code == 502


# --------------------------------------------------------------------------- #
# Photo pipeline
# --------------------------------------------------------------------------- #


async def test_analyze_photo_validates_mime() -> None:
    service = MealAnalysisService(FakeAI())
    with pytest.raises(HTTPException) as exc:
        await service.analyze_photo(b"garbage", "text/plain")
    assert exc.value.status_code == 400


async def test_analyze_photo_label_path_uses_classify_and_read_label() -> None:
    """Label visible & readable → classify + read_label + estimate_weight."""
    ai = FakeAI(
        replies={
            AIStage.CLASSIFY: "YES",
            AIStage.READ_LABEL: _KBJU_REPLY,
            AIStage.ESTIMATE_WEIGHT: _WEIGHT_REPLY,
        }
    )
    service = MealAnalysisService(ai)

    result = await service.analyze_photo(b"\x89PNG", "image/png")

    stages = [stage for _, stage in ai.calls]
    assert AIStage.CLASSIFY in stages
    assert AIStage.READ_LABEL in stages
    assert AIStage.ESTIMATE_WEIGHT in stages
    assert "этикетк" in result.dish_name.lower() or result.dish_name
    assert result.confidence == 0.9
    assert result.estimated_weight == 250.0


async def test_analyze_photo_model_path_uses_identify_kbju_and_weight() -> None:
    """No label → classify + identify_food + estimate_kbju + estimate_weight."""
    ai = FakeAI(
        replies={
            AIStage.CLASSIFY: "NO",
            AIStage.IDENTIFY_FOOD: _DISH_REPLY,
            AIStage.ESTIMATE_KBJU: _KBJU_REPLY,
            AIStage.ESTIMATE_WEIGHT: _WEIGHT_REPLY,
        }
    )
    service = MealAnalysisService(ai)

    result = await service.analyze_photo(b"\x89PNG", "image/png")

    stages = [stage for _, stage in ai.calls]
    assert AIStage.CLASSIFY in stages
    assert AIStage.IDENTIFY_FOOD in stages
    assert AIStage.ESTIMATE_KBJU in stages
    assert AIStage.ESTIMATE_WEIGHT in stages
    assert result.dish_name.startswith("Овсянка")
    assert result.confidence == 0.6


async def test_analyze_photo_label_fallback_when_label_unreadable() -> None:
    """Label visible but unreadable → fallback to the model path."""
    ai = FakeAI(
        replies={
            AIStage.CLASSIFY: "YES",
            AIStage.READ_LABEL: "garbled label, no numbers",
            AIStage.IDENTIFY_FOOD: _DISH_REPLY,
            AIStage.ESTIMATE_KBJU: _KBJU_REPLY,
            AIStage.ESTIMATE_WEIGHT: _WEIGHT_REPLY,
        }
    )
    service = MealAnalysisService(ai)

    result = await service.analyze_photo(b"\x89PNG", "image/png")

    assert result.confidence == 0.7
    assert "этикетка" in (result.notes or "")


# --------------------------------------------------------------------------- #
# Voice pipeline
# --------------------------------------------------------------------------- #


async def test_analyze_voice_returns_transcript_and_analysis() -> None:
    ai = FakeAI(
        audio_reply="овсянка с ягодами, около 250 грамм",
        replies={
            AIStage.IDENTIFY_FOOD: _DISH_REPLY,
            AIStage.ESTIMATE_KBJU: _KBJU_REPLY,
            AIStage.ESTIMATE_WEIGHT: _WEIGHT_REPLY,
        },
    )
    service = MealAnalysisService(ai)

    result = await service.analyze_voice(b"\x00\x01", "audio/webm")

    assert result.transcribed_text == "овсянка с ягодами, около 250 грамм"
    assert result.dish_name.startswith("Овсянка")
    assert ai.calls[0][0] == "audio"


async def test_analyze_voice_rejects_empty_transcript() -> None:
    ai = FakeAI(audio_reply="")
    service = MealAnalysisService(ai)
    with pytest.raises(HTTPException) as exc:
        await service.analyze_voice(b"\x00", "audio/webm")
    assert exc.value.status_code == 502
