import json
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.database import AsyncSessionLocal
from app.repositories.chat import ChatRepository
from app.repositories.user import UserRepository
from app.services.auth import decode_token
from app.services.chat import ChatService

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self.active: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self.active.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        conns = self.active.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                pass


manager = ConnectionManager()


def _serialize(message) -> dict:
    return {
        "type": "message",
        "id": message.id,
        "sender_id": message.sender_id,
        "receiver_id": message.receiver_id,
        "content": message.content,
        "is_read": message.is_read,
        "created_at": message.created_at.isoformat(),
    }


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                receiver_id = int(data["receiver_id"])
                content = str(data.get("content", ""))
            except (KeyError, ValueError, TypeError, json.JSONDecodeError):
                await websocket.send_text(
                    json.dumps({"type": "error", "detail": "Invalid payload"})
                )
                continue

            async with AsyncSessionLocal() as db:
                service = ChatService(ChatRepository(db), UserRepository(db))
                try:
                    message = await service.send_message(
                        user_id, receiver_id, content
                    )
                except HTTPException as exc:
                    await websocket.send_text(
                        json.dumps(
                            {"type": "error", "detail": str(exc.detail)}
                        )
                    )
                    continue

            msg_payload = _serialize(message)

            await manager.send_to_user(user_id, msg_payload)
            if receiver_id != user_id:
                await manager.send_to_user(receiver_id, msg_payload)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)
