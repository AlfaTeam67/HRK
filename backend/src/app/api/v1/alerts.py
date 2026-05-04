import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.websockets import manager
from app.schemas.alert import AlertRead
from app.service.alert import AlertService

router = APIRouter()


@router.get("/", response_model=list[AlertRead])
async def get_alerts(
    account_manager_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[AlertRead]:
    service = AlertService(db)
    return await service.get_alerts(account_manager_id=account_manager_id)


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        # Initial message to confirm connection
        await manager.send_personal_message(
            {"type": "connection_established", "client_id": client_id},
            websocket
        )
        while True:
            # Keep connection alive and wait for messages if any (though we mostly push)
            data = await websocket.receive_text()
            # Echo or handle incoming data if needed
            await manager.send_personal_message({"echo": data}, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
