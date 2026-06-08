from __future__ import annotations

from datetime import date

PREFIX = "/api/v1"


async def test_analyze_text_returns_structured_payload(
    client, register_user, fake_ai
) -> None:
    user = await register_user(email="ai-text@example.com")
    res = await client.post(
        f"{PREFIX}/nutrition/analyze/text",
        headers=user["headers"],
        json={"text": "oatmeal with berries, 250g"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["dish_name"] == "Oatmeal with berries"
    assert body["calories"] == 320.0
    assert body["estimated_weight"] == 250.0
    assert fake_ai.calls == ["text:oatmeal with berries, 250g"]


async def test_analyze_text_requires_auth(client) -> None:
    res = await client.post(
        f"{PREFIX}/nutrition/analyze/text", json={"text": "soup"}
    )
    assert res.status_code in (401, 403)


async def test_analyze_text_rejects_short_input(client, register_user) -> None:
    user = await register_user(email="ai-short@example.com")
    res = await client.post(
        f"{PREFIX}/nutrition/analyze/text",
        headers=user["headers"],
        json={"text": "x"},
    )
    assert res.status_code == 422


async def test_analyze_photo_accepts_upload(client, register_user, fake_ai) -> None:
    user = await register_user(email="ai-photo@example.com")
    payload = b"\x89PNG\r\n\x1a\n" + b"0" * 32
    res = await client.post(
        f"{PREFIX}/nutrition/analyze/photo",
        headers=user["headers"],
        files={"file": ("dish.png", payload, "image/png")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["dish_name"] == "Caesar salad"
    assert any(c.startswith("photo:image/png:") for c in fake_ai.calls)


async def test_analyze_photo_rejects_empty_upload(client, register_user) -> None:
    user = await register_user(email="ai-photo2@example.com")
    res = await client.post(
        f"{PREFIX}/nutrition/analyze/photo",
        headers=user["headers"],
        files={"file": ("empty.png", b"", "image/png")},
    )
    assert res.status_code == 400


async def test_analyze_voice_returns_transcript(
    client, register_user, fake_ai
) -> None:
    user = await register_user(email="ai-voice@example.com")
    res = await client.post(
        f"{PREFIX}/nutrition/analyze/voice",
        headers=user["headers"],
        files={"file": ("note.webm", b"\x1aE\xdf\xa3", "audio/webm")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["transcribed_text"] == "buckwheat with chicken, 350 grams"
    assert body["dish_name"] == "Buckwheat with chicken"
    assert any(c.startswith("voice:audio/webm:") for c in fake_ai.calls)


async def test_confirm_persists_meal_item_from_analysis(
    client, register_user
) -> None:
    user = await register_user(email="ai-confirm@example.com")
    today = date.today().isoformat()

    meal = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=user["headers"],
            json={"date": today, "meal_type": "lunch"},
        )
    ).json()

    res = await client.post(
        f"{PREFIX}/nutrition/analyze/{meal['id']}/confirm",
        headers=user["headers"],
        json={
            "dish_name": "Oatmeal with berries",
            "estimated_weight": 250,
            "calories": 320,
            "proteins": 12,
            "fats": 6,
            "carbs": 55,
        },
    )
    assert res.status_code == 201, res.text
    item = res.json()
    assert item["amount_grams"] == 250.0
    assert item["calories"] == 320.0
    assert item["product"]["name"] == "Oatmeal with berries"
    assert item["product"]["calories_per_100g"] == 128.0


async def test_confirm_rejects_foreign_meal(client, register_user) -> None:
    owner = await register_user(email="ai-owner@example.com")
    intruder = await register_user(email="ai-intruder@example.com")
    today = date.today().isoformat()
    meal = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=owner["headers"],
            json={"date": today, "meal_type": "lunch"},
        )
    ).json()

    res = await client.post(
        f"{PREFIX}/nutrition/analyze/{meal['id']}/confirm",
        headers=intruder["headers"],
        json={
            "dish_name": "Salad",
            "estimated_weight": 100,
            "calories": 50,
            "proteins": 1,
            "fats": 1,
            "carbs": 5,
        },
    )
    assert res.status_code == 404
