from __future__ import annotations

from datetime import date

PREFIX = "/api/v1"


async def test_full_user_and_trainer_flow(client, register_user) -> None:
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

    relogin = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "user@example.com", "password": "user-pwd"},
    )
    assert relogin.status_code == 200, relogin.text
    user["headers"] = {
        "Authorization": f"Bearer {relogin.json()['access_token']}"
    }

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

    sent = await client.post(
        f"{PREFIX}/chat/",
        headers=user["headers"],
        json={
            "receiver_id": trainer["id"],
            "content": "Coach, is this enough protein?",
        },
    )
    assert sent.status_code == 201, sent.text

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
