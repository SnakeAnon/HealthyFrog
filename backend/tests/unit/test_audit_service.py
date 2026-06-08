from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from app.services import audit as audit_service


async def test_log_swallows_repository_failures(monkeypatch) -> None:
    """A failing INSERT must NOT propagate — the primary operation wins."""
    fake_repo_cls = MagicMock()
    fake_repo = MagicMock()
    fake_repo.create = AsyncMock(side_effect=RuntimeError("boom"))
    fake_repo_cls.return_value = fake_repo

    monkeypatch.setattr(
        "app.services.audit.AuditRepository", fake_repo_cls
    )

    db = MagicMock()
    db.rollback = AsyncMock()

    result = await audit_service.log(
        db,
        user_id=1,
        action="user.login",
    )
    assert result is None
    fake_repo.create.assert_awaited_once()
    # The session should be rolled back so subsequent ops on it succeed.
    db.rollback.assert_awaited_once()


async def test_log_returns_row_on_success(monkeypatch) -> None:
    saved = MagicMock(id=42)
    fake_repo_cls = MagicMock()
    fake_repo = MagicMock()
    fake_repo.create = AsyncMock(return_value=saved)
    fake_repo_cls.return_value = fake_repo

    monkeypatch.setattr(
        "app.services.audit.AuditRepository", fake_repo_cls
    )

    db = MagicMock()
    result = await audit_service.log(
        db,
        user_id=1,
        action="user.login",
        entity_type="user",
        entity_id=1,
        payload={"ip": "127.0.0.1"},
    )
    assert result is saved
    fake_repo.create.assert_awaited_once_with(
        user_id=1,
        action="user.login",
        entity_type="user",
        entity_id=1,
        payload={"ip": "127.0.0.1"},
    )
