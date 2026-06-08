from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass

from fastapi import HTTPException, status

from app.services.ai_client import AIClient, AIStage


# --------------------------------------------------------------------------- #
# Domain types
# --------------------------------------------------------------------------- #


@dataclass
class KBJU:
    """Macro-nutrients: kcal, proteins, fats, carbs (grams)."""

    k: float  # kcal
    b: float  # proteins
    j: float  # fats
    u: float  # carbs


@dataclass
class PipelineResult:
    has_label: bool
    kbju_source: str  # "label" | "model" | "label_fallback"
    dish_description: str
    kbju_per_100g: KBJU
    weight_g: float
    kbju_total: KBJU


# --------------------------------------------------------------------------- #
# Parsers
# --------------------------------------------------------------------------- #


_KBJU_RE = {
    "k": re.compile(
        r"(?:K|К|ККАЛ|КАЛОРИ[ЯИЙ])\s*[:=]\s*(-?\d+(?:[.,]\d+)?)", re.IGNORECASE
    ),
    "b": re.compile(r"(?:B|Б|БЕЛКИ?)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)", re.IGNORECASE),
    "j": re.compile(r"(?:J|Ж|ЖИРЫ?)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)", re.IGNORECASE),
    "u": re.compile(
        r"(?:U|У|УГЛЕВОДЫ?)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)", re.IGNORECASE
    ),
}


def _parse_kbju(text: str) -> KBJU:
    matches = {key: pat.search(text) for key, pat in _KBJU_RE.items()}
    if all(matches.values()):
        nums = [float(m.group(1).replace(",", ".")) for m in matches.values()]  # type: ignore[union-attr]
        return KBJU(k=nums[0], b=nums[1], j=nums[2], u=nums[3])

    fallback = re.findall(r"-?\d+(?:[.,]\d+)?", text)
    if len(fallback) >= 4:
        nums = [float(n.replace(",", ".")) for n in fallback[:4]]
        return KBJU(k=nums[0], b=nums[1], j=nums[2], u=nums[3])

    raise ValueError(f"Не удалось извлечь КБЖУ из ответа: {text!r}")


_WEIGHT_RE = re.compile(
    r"(?:WEIGHT_G|WEIGHT|ВЕС|ГРАММОВКА)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)


def _parse_weight(text: str) -> float:
    """Extract portion weight in grams from a model reply."""
    match = _WEIGHT_RE.search(text)
    if not match:
        match = re.search(r"(\d+(?:[.,]\d+)?)", text)
    if not match:
        raise ValueError(f"Не удалось извлечь вес из: {text!r}")
    value = float(match.group(1).replace(",", "."))
    if value <= 0:
        raise ValueError(f"Некорректный вес порции: {value}")
    return round(value, 1)


# --------------------------------------------------------------------------- #
# Agents
# --------------------------------------------------------------------------- #


_REF_SIZES = """\
### REF_SIZES (эталоны масштаба)
Вилка: 16×3 см; Нож: 21 см; Тарелка стандарт: Ø27 см; Тарелка десерт: Ø19 см;
Чашка кофе: 8×9 см; Стакан IKEA: 8.5×10 см; Ладонь взрослого: ≈9 см; Банковская карта: 8.56×5.4 см."""

_REF_DENSITIES = """\
### REF_DENSITIES (плотность г/см³)
Вода: 1.00; Каша густая: 0.90; Выпечка пористая: 0.35; Мясо жареное: 1.10;
Сыр твёрдый: 1.05; Шоколад: 1.15; Орехи: 0.60; Чипсы: 0.25."""

_MICRO_ANCHORS = """\
### MICRO_ANCHORS (мелкие объекты, г)
Чипс: 1.2; Крекер: 2; Миндаль: 1; Сахар-кубик: 4.2;
Чайная ложка: 5; Столовая ложка: 15; Стакан воды: 200; Тортилья Ø12: 20."""

_TYPICAL_PORTIONS = """\
### ТИПОВЫЕ_ПОРЦИИ (если вес не указан)
Каша/гарнир: 200 г; Суп: 300 г; Салат: 150 г; Мясо: 250 г; Рыба: 200 г;
Напиток: 200 мл; Булка/круассан: 60 г; Батончик: 45 г;
Банан: 120 г; Яблоко: 150 г; Пицца (1 кусок): 130 г."""


async def agent_classify(
    ai: AIClient, image_bytes: bytes, mime_type: str
) -> bool:
    """Agent 1 — does the photo contain a readable nutritional label?"""
    prompt = (
        "Посмотри на изображение. Проведи OCR: есть ли на фото пищевая этикетка "
        "или таблица с данными КБЖУ (калории, белки, жиры, углеводы)?\n"
        "Учитывай: надписи «Protein», «ккал», «Энергетическая ценность», «кДж», "
        "таблицы состава на упаковке — всё это признаки этикетки.\n"
        "Ответь строго одним словом: YES — если этикетка есть и КБЖУ читаемо, "
        "NO — во всех остальных случаях."
    )
    answer = await ai.generate_with_image(
        prompt, image_bytes, mime_type, stage=AIStage.CLASSIFY
    )
    return answer.strip().upper().startswith("YES")


async def agent_read_label(
    ai: AIClient, image_bytes: bytes, mime_type: str
) -> KBJU:
    """Agent 2a — read KBJU per 100g directly from a packaging label."""
    prompt = (
        "Проведи OCR пищевой этикетки на фото.\n"
        "Правила приоритетов:\n"
        "а) Если видишь ВЕС и КБЖУ — сделай пересчёт на 100 г.\n"
        "б) Если видишь только КБЖУ на 100 г — используй их напрямую.\n"
        "в) Если видишь КБЖУ на порцию с указанием размера порции — пересчитай на 100 г.\n"
        "При конфликте «текст vs картинка» — побеждает текст с упаковки.\n"
        "Ответь строго в формате: K=<ккал>; B=<белки>; J=<жиры>; U=<углеводы>. "
        "Только числа (можно с точкой), без единиц и пояснений."
    )
    answer = await ai.generate_with_image(
        prompt, image_bytes, mime_type, stage=AIStage.READ_LABEL
    )
    return _parse_kbju(answer)


async def agent_identify_food_from_image(
    ai: AIClient, image_bytes: bytes, mime_type: str, hint: str | None = None
) -> str:
    """Agent 2b — describe the dish on the photo (no label)."""
    hint_block = (
        f'\nКомментарий пользователя (приоритет над визуалом): "{hint.strip()}"'
        if hint and hint.strip()
        else ""
    )
    prompt = (
        "Ты — нутрициолог с экспертным зрением. На фото блюдо без пищевой этикетки.\n\n"
        "<REASONING>\n"
        "• Детектируй каждый пищевой объект на фото (YOLO-style).\n"
        "• Проведи OCR: считай любой текст с упаковки или этикеток — он важнее визуальной оценки.\n"
        "• Если есть комментарий пользователя — он имеет приоритет над изображением.\n"
        "• Определи способ приготовления (жареное, варёное, запечённое, сырое).\n"
        "• Состав сложных блюд разбей на компоненты (например: рис, курица, соус).\n"
        "</REASONING>\n\n"
        "Ответь строго в формате:\n"
        "Строка 1: краткое название блюда, 2-5 слов (то, что пользователь запомнит).\n"
        "Строка 2-3: состав и способ приготовления, 1-2 предложения.\n"
        "Пример:\nГречка с курицей\nОтварная гречневая крупа, жареное куриное филе, немного растительного масла."
        + hint_block
    )
    answer = await ai.generate_with_image(
        prompt, image_bytes, mime_type, stage=AIStage.IDENTIFY_FOOD
    )
    if not answer.strip():
        raise ValueError("Агент идентификации блюда не вернул ответ")
    return answer.strip()


async def agent_identify_food_from_text(ai: AIClient, description: str) -> str:
    """Agent 2b (text variant) — clean up a free-form user description."""
    prompt = (
        "Ты — нутрициолог. Пользователь описал еду словами.\n\n"
        "<REASONING>\n"
        "• Разбей описание на отдельные продукты/блюда.\n"
        "• Если указаны только ингредиенты — предположи, какое блюдо из них получится.\n"
        "• Учти модификаторы: «без сахара», «обезжиренный», «двойная порция», «с маслом».\n"
        "• Если указана граммовка — сохрани её.\n"
        "</REASONING>\n\n"
        f'{_TYPICAL_PORTIONS}\n\n'
        f'{_MICRO_ANCHORS}\n\n'
        "Верни ответ строго в формате:\n"
        "Строка 1: краткое название, 2-5 слов, без лишних слов.\n"
        "Строка 2-3: уточнённый состав и способ приготовления (1-2 предложения).\n"
        "Пример:\nКаша с бананом\nОвсяная каша на воде, один банан (~120 г).\n\n"
        f'Описание пользователя: """\n{description.strip()}\n"""'
    )
    answer = await ai.generate_text(prompt, stage=AIStage.IDENTIFY_FOOD)
    if not answer.strip():
        raise ValueError("Агент идентификации блюда не вернул ответ")
    return answer.strip()


async def agent_estimate_weight_from_image(
    ai: AIClient,
    image_bytes: bytes,
    mime_type: str,
    dish_description: str,
) -> float:
    """Agent 3 — estimate portion weight in grams from the photo."""
    context = f"Блюдо: {dish_description}\n" if dish_description else ""
    prompt = (
        f"{context}"
        "Оцени вес еды, которая ВИДНА НА ФОТО — именно столько человек собирается съесть.\n"
        "Правило: измеряй то, что в кадре, а не «стандартную порцию».\n"
        "Если видна одна тарелка с едой — взвесь содержимое тарелки.\n"
        "Если виден один кусок — взвесь кусок. Если видна целая пицца — взвесь всю пиццу.\n\n"
        "<REASONING>\n"
        "• Найди эталон масштаба в кадре (тарелка, вилка, рука, карта).\n"
        "• Оцени объём: длина × ширина × высота × плотность из REF_DENSITIES.\n"
        "• Для мелких объектов используй MICRO_ANCHORS.\n"
        "• Если эталона нет совсем — используй ТИПОВЫЕ_ПОРЦИИ как последний резерв.\n"
        "• Округли: <30 г → 1 г; 30–100 г → 5 г; 100–200 г → 10 г; >200 г → 25 г.\n"
        "</REASONING>\n\n"
        f"{_REF_SIZES}\n\n"
        f"{_REF_DENSITIES}\n\n"
        f"{_MICRO_ANCHORS}\n\n"
        f"{_TYPICAL_PORTIONS}\n\n"
        "Ответь строго в формате: WEIGHT_G=<число>. Без пояснений."
    )
    answer = await ai.generate_with_image(
        prompt, image_bytes, mime_type, stage=AIStage.ESTIMATE_WEIGHT
    )
    return _parse_weight(answer)


async def agent_estimate_weight_from_text(
    ai: AIClient, description: str
) -> float:
    """Agent 3 (text variant) — estimate portion weight from the description."""
    prompt = (
        "Оцени вес одной порции в граммах по описанию.\n\n"
        "<REASONING>\n"
        "• Если в тексте явно указана граммовка — используй её.\n"
        "• Если указаны единицы (ложки, стаканы, кусочки) — переведи через MICRO_ANCHORS.\n"
        "• Если указаны «большой/маленький/двойная порция» — скорректируй ТИПОВЫЕ_ПОРЦИИ.\n"
        "• Округли: <30 г → 1 г; 30–100 г → 5 г; 100–200 г → 10 г; >200 г → 25 г.\n"
        "</REASONING>\n\n"
        f"{_TYPICAL_PORTIONS}\n\n"
        f"{_MICRO_ANCHORS}\n\n"
        f'Описание: """\n{description.strip()}\n"""\n\n'
        "Ответь строго в формате: WEIGHT_G=<число>. Без пояснений."
    )
    answer = await ai.generate_text(prompt, stage=AIStage.ESTIMATE_WEIGHT)
    return _parse_weight(answer)


async def agent_estimate_kbju_per_100g(
    ai: AIClient, dish_description: str
) -> KBJU:
    """Agent 4 — KBJU per 100g for the dish, from its textual description."""
    prompt = (
        f"Блюдо: {dish_description}\n\n"
        "Оцени КБЖУ на 100 г, опираясь на базы USDA / Роспотребнадзор.\n\n"
        "<REASONING>\n"
        "• Для сложных блюд посчитай КБЖУ каждого компонента и взвесь по доле.\n"
        "• Учти способ приготовления: жарка добавляет жиры, варка — нет.\n"
        "• Модификаторы «без сахара», «обезжиренный» — скорректируй соответственно.\n"
        "• Если упомянуты соус, масло, заправка — включи их вклад.\n"
        "</REASONING>\n\n"
        "Ответь строго в формате: K=<ккал>; B=<белки>; J=<жиры>; U=<углеводы>. "
        "Только числа с точностью до 0.1, без единиц и пояснений."
    )
    answer = await ai.generate_text(prompt, stage=AIStage.ESTIMATE_KBJU)
    return _parse_kbju(answer)


# --------------------------------------------------------------------------- #
# Orchestrators
# --------------------------------------------------------------------------- #


def _scale_kbju(per_100g: KBJU, weight_g: float) -> KBJU:
    multiplier = weight_g / 100.0
    return KBJU(
        k=round(per_100g.k * multiplier, 1),
        b=round(per_100g.b * multiplier, 1),
        j=round(per_100g.j * multiplier, 1),
        u=round(per_100g.u * multiplier, 1),
    )


async def run_photo_pipeline(
    ai: AIClient, image_bytes: bytes, mime_type: str, *, hint: str | None = None
) -> PipelineResult:
    """Full multi-agent flow for a meal photo (mirrors ``health_v2``)."""
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image upload",
        )

    try:
        has_label = await agent_classify(ai, image_bytes, mime_type)

        if has_label:
            try:
                kbju_per_100g, weight_g = await asyncio.gather(
                    agent_read_label(ai, image_bytes, mime_type),
                    agent_estimate_weight_from_image(
                        ai, image_bytes, mime_type, ""
                    ),
                )
                dish_description = ""
                kbju_source = "label"
            except ValueError:
                dish_description = await agent_identify_food_from_image(
                    ai, image_bytes, mime_type, hint=hint
                )
                kbju_per_100g, weight_g = await asyncio.gather(
                    agent_estimate_kbju_per_100g(ai, dish_description),
                    agent_estimate_weight_from_image(
                        ai, image_bytes, mime_type, dish_description
                    ),
                )
                kbju_source = "label_fallback"
        else:
            dish_description = await agent_identify_food_from_image(
                ai, image_bytes, mime_type, hint=hint
            )
            kbju_per_100g, weight_g = await asyncio.gather(
                agent_estimate_kbju_per_100g(ai, dish_description),
                agent_estimate_weight_from_image(
                    ai, image_bytes, mime_type, dish_description
                ),
            )
            kbju_source = "model"
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Nutrition AI returned a malformed response: {exc}",
        ) from exc

    return PipelineResult(
        has_label=has_label,
        kbju_source=kbju_source,
        dish_description=dish_description,
        kbju_per_100g=kbju_per_100g,
        weight_g=weight_g,
        kbju_total=_scale_kbju(kbju_per_100g, weight_g),
    )


async def run_text_pipeline(ai: AIClient, description: str) -> PipelineResult:
    cleaned = (description or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Description must not be empty",
        )

    try:
        dish_description = await agent_identify_food_from_text(ai, cleaned)
        kbju_per_100g, weight_g = await asyncio.gather(
            agent_estimate_kbju_per_100g(ai, dish_description),
            agent_estimate_weight_from_text(ai, cleaned),
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Nutrition AI returned a malformed response: {exc}",
        ) from exc

    return PipelineResult(
        has_label=False,
        kbju_source="model",
        dish_description=dish_description,
        kbju_per_100g=kbju_per_100g,
        weight_g=weight_g,
        kbju_total=_scale_kbju(kbju_per_100g, weight_g),
    )
