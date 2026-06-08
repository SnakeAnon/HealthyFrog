from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.repositories.metrics import WeightLogRepository
from app.repositories.user import UserRepository
from app.services.metrics import WeightService


async def _make_user(db_session, *, weight: float | None = None):
    from app.models.user import User, UserRole
    from app.services.auth import hash_password

    user = User(
        email=f"weight-{id(db_session)}@example.com",
        hashed_password=hash_password("x"),
        role=UserRole.user,
        name="Weight Tester",
        weight=weight,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_record_weight_creates_then_updates(db_session):
    user = await _make_user(db_session)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    today = date.today()
    first = await service.record_weight(user.id, today, 80.0)
    assert first.weight == 80.0

    second = await service.record_weight(user.id, today, 79.5)
    assert second.id == first.id
    assert second.weight == 79.5

    history = await service.get_history(user.id, today, today)
    assert len(history) == 1


async def test_record_weight_updates_user_weight(db_session):
    user = await _make_user(db_session, weight=70.0)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    today = date.today()
    await service.record_weight(user.id, today, 71.5)

    refreshed = await UserRepository(db_session).get_by_id(user.id)
    assert refreshed is not None
    assert refreshed.weight == 71.5


async def test_record_weight_rejects_future_date(db_session):
    user = await _make_user(db_session)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    with pytest.raises(HTTPException) as exc:
        await service.record_weight(
            user.id, date.today() + timedelta(days=1), 70.0
        )
    assert exc.value.status_code == 400


async def test_record_weight_rejects_non_positive(db_session):
    user = await _make_user(db_session)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    with pytest.raises(HTTPException) as exc:
        await service.record_weight(user.id, date.today(), 0)
    assert exc.value.status_code == 400


async def test_trend_with_no_entries(db_session):
    user = await _make_user(db_session)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    trend = await service.get_trend(user.id, days=30)
    assert trend.entries == 0
    assert trend.first_weight is None
    assert trend.last_weight is None


async def test_trend_calculates_delta_and_per_day(db_session):
    user = await _make_user(db_session)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    today = date.today()
    await service.record_weight(user.id, today - timedelta(days=10), 85.0)
    await service.record_weight(user.id, today - timedelta(days=5), 84.0)
    await service.record_weight(user.id, today, 83.5)

    trend = await service.get_trend(user.id, days=30)
    assert trend.entries == 3
    assert trend.first_weight == 85.0
    assert trend.last_weight == 83.5
    assert trend.delta == -1.5
    # 1.5 kg lost over 10 days → -0.15 kg/day.
    assert trend.avg_change_per_day == -0.15


async def test_history_rejects_inverted_range(db_session):
    user = await _make_user(db_session)
    service = WeightService(
        WeightLogRepository(db_session), UserRepository(db_session)
    )

    with pytest.raises(HTTPException) as exc:
        await service.get_history(
            user.id, date.today(), date.today() - timedelta(days=1)
        )
    assert exc.value.status_code == 400
