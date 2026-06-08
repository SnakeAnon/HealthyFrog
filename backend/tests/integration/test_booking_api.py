from __future__ import annotations

from datetime import datetime, timedelta, timezone

PREFIX = "/api/v1"


def _slot_payload(hours_ahead: int = 1, duration_min: int = 60) -> dict:
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(
        hours=hours_ahead
    )
    end = start + timedelta(minutes=duration_min)
    return {"start_time": start.isoformat(), "end_time": end.isoformat()}


async def test_only_trainer_can_create_slot(client, register_user) -> None:
    client_user = await register_user(email="bk-client@example.com", role="user")
    res = await client.post(
        f"{PREFIX}/bookings/slots",
        headers=client_user["headers"],
        json=_slot_payload(),
    )
    assert res.status_code == 403


async def test_trainer_creates_slot_and_user_books_it(
    client, register_user
) -> None:
    trainer = await register_user(email="bk-coach@example.com", role="trainer")
    user = await register_user(email="bk-user@example.com", role="user")

    slot = await client.post(
        f"{PREFIX}/bookings/slots",
        headers=trainer["headers"],
        json=_slot_payload(),
    )
    assert slot.status_code == 201, slot.text
    slot_id = slot.json()["id"]

    available = await client.get(
        f"{PREFIX}/bookings/slots/{trainer['id']}",
        headers=user["headers"],
    )
    assert available.status_code == 200
    assert any(s["id"] == slot_id for s in available.json())

    booking = await client.post(
        f"{PREFIX}/bookings/",
        headers=user["headers"],
        json={"slot_id": slot_id},
    )
    assert booking.status_code == 201, booking.text
    body = booking.json()
    assert body["user_id"] == user["id"]
    assert body["slot"]["id"] == slot_id

    available_after = await client.get(
        f"{PREFIX}/bookings/slots/{trainer['id']}",
        headers=user["headers"],
    )
    assert available_after.status_code == 200
    assert available_after.json() == []


async def test_double_booking_is_rejected(client, register_user) -> None:
    trainer = await register_user(email="bk-coach2@example.com", role="trainer")
    user_a = await register_user(email="bk-a@example.com", role="user")
    user_b = await register_user(email="bk-b@example.com", role="user")

    slot = (
        await client.post(
            f"{PREFIX}/bookings/slots",
            headers=trainer["headers"],
            json=_slot_payload(hours_ahead=2),
        )
    ).json()

    first = await client.post(
        f"{PREFIX}/bookings/",
        headers=user_a["headers"],
        json={"slot_id": slot["id"]},
    )
    assert first.status_code == 201

    second = await client.post(
        f"{PREFIX}/bookings/",
        headers=user_b["headers"],
        json={"slot_id": slot["id"]},
    )
    assert second.status_code == 400


async def test_trainer_sees_bookings_from_clients(
    client, register_user
) -> None:
    trainer = await register_user(email="bk-coach3@example.com", role="trainer")
    user = await register_user(email="bk-c@example.com", role="user")

    slot = (
        await client.post(
            f"{PREFIX}/bookings/slots",
            headers=trainer["headers"],
            json=_slot_payload(hours_ahead=3),
        )
    ).json()
    await client.post(
        f"{PREFIX}/bookings/",
        headers=user["headers"],
        json={"slot_id": slot["id"]},
    )

    res = await client.get(
        f"{PREFIX}/bookings/trainer-bookings", headers=trainer["headers"]
    )
    assert res.status_code == 200
    bookings = res.json()
    assert len(bookings) == 1
    assert bookings[0]["user_id"] == user["id"]
