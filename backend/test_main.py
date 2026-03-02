"""Test server that mounts the local test client and entropy loop backend."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import entropy_loop_app as core


class SubmitPayload(BaseModel):
    text: str
    language: str | None = None


app = FastAPI(title="Entropy Loop Test", lifespan=core.lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/submit")
async def submit_poem(payload: SubmitPayload):
    poem_id = await core.insert_poem(payload.text.strip(), generation=0, status="pending", source_type="user")
    await core.log_queue_event("submit", "Local user submission", {"poem_id": poem_id})
    return {"status": "queued"}


@app.get("/queue-logs")
async def queue_logs():
    return await core.fetch_queue_logs_grouped()


@app.get("/local-poems")
async def local_poems():
    return await core.fetch_local_poems_by_source()


@app.websocket("/ws/visuals")
async def visuals_ws(websocket: WebSocket):
    await core.manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        core.manager.disconnect(websocket)
    except Exception:
        core.manager.disconnect(websocket)


root_dir = Path(__file__).resolve().parents[1]
client_dir = root_dir / "test_client"
app.mount("/", StaticFiles(directory=client_dir, html=True), name="test_client")


@app.get("/admin.html")
async def admin_page():
    admin_path = root_dir / "admin.html"
    return FileResponse(admin_path)
