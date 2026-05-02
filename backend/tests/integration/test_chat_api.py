"""Integration tests for the chat REST endpoints.

Test level: **integration**.

Covers message sending, conversation retrieval, the dialog list, the
mark-as-read flow and the access-control guarantee that an outsider
cannot read a conversation between two other participants.
"""

from __future__ import annotations

PREFIX = "/api/v1"


async def test_send_message_requires_auth(client) -> None:
    res = await client.post(
        f"{PREFIX}/chat/", json={"receiver_id": 1, "content": "hi"}
    )
    assert res.status_code in (401, 403)


async def test_send_and_fetch_conversation(client, register_user) -> None:
    sender = await register_user(email="s@example.com")
    receiver = await register_user(email="r@example.com")

    sent = await client.post(
        f"{PREFIX}/chat/",
        headers=sender["headers"],
        json={"receiver_id": receiver["id"], "content": "hello"},
    )
    assert sent.status_code == 201, sent.text
    body = sent.json()
    assert body["sender_id"] == sender["id"]
    assert body["receiver_id"] == receiver["id"]
    assert body["is_read"] is False

    history_sender = await client.get(
        f"{PREFIX}/chat/{receiver['id']}", headers=sender["headers"]
    )
    history_receiver = await client.get(
        f"{PREFIX}/chat/{sender['id']}", headers=receiver["headers"]
    )

    assert history_sender.status_code == 200
    assert history_receiver.status_code == 200
    # Both participants see exactly one message with the same id.
    assert [m["id"] for m in history_sender.json()] == [body["id"]]
    assert [m["id"] for m in history_receiver.json()] == [body["id"]]


async def test_send_message_to_self_is_rejected(client, register_user) -> None:
    user = await register_user(email="self@example.com")
    res = await client.post(
        f"{PREFIX}/chat/",
        headers=user["headers"],
        json={"receiver_id": user["id"], "content": "to myself"},
    )
    assert res.status_code == 400


async def test_send_message_to_unknown_user_returns_404(
    client, register_user
) -> None:
    user = await register_user(email="ghost@example.com")
    res = await client.post(
        f"{PREFIX}/chat/",
        headers=user["headers"],
        json={"receiver_id": 99999, "content": "hi"},
    )
    assert res.status_code == 404


async def test_outsider_cannot_read_others_conversation(
    client, register_user
) -> None:
    a = await register_user(email="a@example.com")
    b = await register_user(email="b@example.com")
    spy = await register_user(email="spy@example.com")

    await client.post(
        f"{PREFIX}/chat/",
        headers=a["headers"],
        json={"receiver_id": b["id"], "content": "secret"},
    )

    # The repository filters by both participants, so requesting `b`'s
    # conversation while authenticated as `spy` returns an empty list.
    res = await client.get(
        f"{PREFIX}/chat/{b['id']}", headers=spy["headers"]
    )
    assert res.status_code == 200
    assert res.json() == []


async def test_dialog_list_and_mark_as_read(client, register_user) -> None:
    me = await register_user(email="me-chat@example.com")
    coach = await register_user(email="coach-chat@example.com")

    await client.post(
        f"{PREFIX}/chat/",
        headers=coach["headers"],
        json={"receiver_id": me["id"], "content": "hi from coach"},
    )
    await client.post(
        f"{PREFIX}/chat/",
        headers=coach["headers"],
        json={"receiver_id": me["id"], "content": "second message"},
    )

    dialogs = await client.get(
        f"{PREFIX}/chat/dialogs", headers=me["headers"]
    )
    assert dialogs.status_code == 200, dialogs.text
    body = dialogs.json()
    assert len(body) == 1
    dialog = body[0]
    assert dialog["other_user_id"] == coach["id"]
    assert dialog["unread_count"] == 2
    assert dialog["last_message"]["content"] == "second message"

    marked = await client.post(
        f"{PREFIX}/chat/{coach['id']}/read", headers=me["headers"]
    )
    assert marked.status_code == 200
    assert marked.json() == {"marked": 2}

    dialogs_after = await client.get(
        f"{PREFIX}/chat/dialogs", headers=me["headers"]
    )
    assert dialogs_after.json()[0]["unread_count"] == 0
