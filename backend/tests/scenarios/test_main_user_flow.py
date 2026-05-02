"""Scenario test for the main user flow.

Test level: **scenario**.

Walks through a realistic end-to-end story that exercises every domain
of the system in the same order a real user would: registration of both
parties, account linking, nutrition logging, daily report computation
and chat exchange between client and trainer. The intent is not to chase
edge cases (those are covered by unit and integration tests) but to make
sure the modules cooperate without regressions.
"""

from __future__ import annotations

from datetime import date

PREFIX = "/api/v1"


async def test_full_user_and_trainer_flow(client, register_user) -> None:
    # Step 1. Register a trainer and a regular client; both are immediately
    # logged in via the issued JWT tokens.
    trainer = await register_user(
        email="trainer@example.com",
        password="coach-pwd",
        name="Coach",
        role="trainer",
    )
    user = await register_user(
        email="user@example.com",
        password="user-pwd",
        name="Client",
        role="user",
    )

    # Step 2. Re-login through the public endpoint to confirm the
    # credentials persisted in the test database.
    relogin = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "user@example.com", "password": "user-pwd"},
    )
    assert relogin.status_code == 200, relogin.text
    user["headers"] = {
        "Authorization": f"Bearer {relogin.json()['access_token']}"
    }

    # Step 3. Link the client to the trainer.
    link = await client.post(
        f"{PREFIX}/users/me/trainer/{trainer['id']}",
        headers=user["headers"],
    )
    assert link.status_code == 200, link.text
    assert link.json()["trainer_id"] == trainer["id"]

    clients_for_trainer = await client.get(
        f"{PREFIX}/users/my-clients", headers=trainer["headers"]
    )
    assert clients_for_trainer.status_code == 200
    assert any(c["id"] == user["id"] for c in clients_for_trainer.json())

    # Step 4. The client builds a one-day food diary.
    today = date.today().isoformat()
    product = (
        await client.post(
            f"{PREFIX}/nutrition/products",
            headers=user["headers"],
            json={
                "name": "Banana",
                "calories_per_100g": 89,
                "protein_per_100g": 1.1,
                "fat_per_100g": 0.3,
                "carbs_per_100g": 23,
            },
        )
    ).json()

    meal = (
        await client.post(
            f"{PREFIX}/nutrition/meals",
            headers=user["headers"],
            json={"date": today, "meal_type": "breakfast"},
        )
    ).json()

    add_item = await client.post(
        f"{PREFIX}/nutrition/meals/{meal['id']}/items",
        headers=user["headers"],
        json={"product_id": product["id"], "amount_grams": 200},
    )
    assert add_item.status_code == 201, add_item.text

    # Step 5. The daily report reflects the freshly logged meal.
    report = await client.get(
        f"{PREFIX}/reports/daily", headers=user["headers"]
    )
    assert report.status_code == 200, report.text
    body = report.json()
    # 200g of banana → 178 cal / 2.2p / 0.6f / 46c.
    assert body["total_calories"] == 178.0
    assert body["total_protein"] == 2.2
    assert body["total_fat"] == 0.6
    assert body["total_carbs"] == 46.0
    assert len(body["meals"]) == 1

    # Step 6. The client sends a question to the trainer.
    sent = await client.post(
        f"{PREFIX}/chat/",
        headers=user["headers"],
        json={
            "receiver_id": trainer["id"],
            "content": "Coach, is this enough protein?",
        },
    )
    assert sent.status_code == 201, sent.text

    # Step 7. The trainer sees the dialog with one unread message and the
    # full conversation transcript.
    dialogs = await client.get(
        f"{PREFIX}/chat/dialogs", headers=trainer["headers"]
    )
    assert dialogs.status_code == 200
    dialog_list = dialogs.json()
    assert len(dialog_list) == 1
    assert dialog_list[0]["other_user_id"] == user["id"]
    assert dialog_list[0]["unread_count"] == 1

    history = await client.get(
        f"{PREFIX}/chat/{user['id']}", headers=trainer["headers"]
    )
    assert history.status_code == 200
    messages = history.json()
    assert len(messages) == 1
    assert messages[0]["content"] == "Coach, is this enough protein?"
    assert messages[0]["sender_id"] == user["id"]
    assert messages[0]["receiver_id"] == trainer["id"]

    # Step 8. The trainer marks the conversation as read; the dialog list
    # should reflect that change.
    marked = await client.post(
        f"{PREFIX}/chat/{user['id']}/read", headers=trainer["headers"]
    )
    assert marked.status_code == 200
    assert marked.json() == {"marked": 1}

    dialogs_after = await client.get(
        f"{PREFIX}/chat/dialogs", headers=trainer["headers"]
    )
    assert dialogs_after.status_code == 200
    assert dialogs_after.json()[0]["unread_count"] == 0
