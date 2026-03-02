"""Offline entropy loop backend (FastAPI + SQLite)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Iterable, List, Optional, Tuple

import aiosqlite
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from langdetect import detect
from langdetect.lang_detect_exception import LangDetectException

from llm_poetry_stitcher import LLMPoetryStitcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("entropy-loop")

DB_PATH = os.getenv("ENTROPY_DB_PATH", "entropy_loop.db")
FETCH_INTERVAL_SECONDS = int(os.getenv("ENTROPY_FETCH_INTERVAL", "60"))
ENTROPY_INTERVAL_SECONDS = int(os.getenv("ENTROPY_INTERVAL", "30"))
MAX_GENERATION = int(os.getenv("ENTROPY_MAX_GENERATION", "2"))
FETCH_ENABLED = os.getenv("ENTROPY_FETCH_ENABLED", "true").lower() == "true"
MIX_MIN_LANGS = int(os.getenv("MIX_MIN_LANGS", "2"))
MIX_MAX_LANGS = int(os.getenv("MIX_MAX_LANGS", "3"))
MIX_MAIN_MIN = int(os.getenv("MIX_MAIN_MIN", "2"))
MIX_MAIN_MAX = int(os.getenv("MIX_MAIN_MAX", "4"))
MIX_SECONDARY_MIN = int(os.getenv("MIX_SECONDARY_MIN", "1"))
MIX_SECONDARY_MAX = int(os.getenv("MIX_SECONDARY_MAX", "2"))
MIX_PROB = float(os.getenv("MIX_PROB", "0.7"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
ENTROPY_LLM_TIMEOUT = int(os.getenv("ENTROPY_LLM_TIMEOUT", "40"))
ENTROPY_LLM_RETRIES = int(os.getenv("ENTROPY_LLM_RETRIES", "2"))
ENTROPY_LLM_MAX_CHARS = int(os.getenv("ENTROPY_LLM_MAX_CHARS", "160"))
OLLAMA_HEALTH_TIMEOUT = float(os.getenv("OLLAMA_HEALTH_TIMEOUT", "1.5"))
OLLAMA_CHECK_INTERVAL = float(os.getenv("OLLAMA_CHECK_INTERVAL", "10"))
NETLIFY_SUBMISSIONS_URL = os.getenv("NETLIFY_SUBMISSIONS_URL")
NETLIFY_ADMIN_PASSWORD = os.getenv("NETLIFY_ADMIN_PASSWORD")
NETLIFY_SUBMIT_URL = os.getenv("NETLIFY_SUBMIT_URL")
NETLIFY_FETCH_LIMIT = int(os.getenv("NETLIFY_FETCH_LIMIT", "50"))

stitcher = LLMPoetryStitcher()
_ollama_last_check = 0.0
_ollama_last_ok = False


def tokenize_text(text: str) -> List[str]:
    return [token for token in text.replace("\n", " ").split(" ") if token.strip()]


def stitch_text(fragments: Iterable[str]) -> str:
    return " ".join(fragment.strip() for fragment in fragments if fragment.strip())


async def generate_llm_poem(fragments: List[str]) -> str:
    if not OLLAMA_BASE_URL:
        raise RuntimeError("OLLAMA_BASE_URL not configured")

    selected = {"mix": fragments}
    controls = {
        "line_mode": "single",
        "poetic_density": 1,
        "allow_connectors": False,
        "must_use_all": True,
        "max_chars": ENTROPY_LLM_MAX_CHARS,
    }
    client_cfg = {
        "base_url": OLLAMA_BASE_URL,
        "model": OLLAMA_MODEL,
        "timeout": ENTROPY_LLM_TIMEOUT,
        "retries": ENTROPY_LLM_RETRIES,
    }

    return await asyncio.to_thread(stitcher.generate, selected, client_cfg, controls)


async def ollama_available() -> bool:
    global _ollama_last_check, _ollama_last_ok
    if not OLLAMA_BASE_URL:
        return False
    now = asyncio.get_event_loop().time()
    if now - _ollama_last_check < OLLAMA_CHECK_INTERVAL:
        return _ollama_last_ok

    _ollama_last_check = now
    url = OLLAMA_BASE_URL.rstrip("/") + "/api/tags"
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_HEALTH_TIMEOUT) as client:
            resp = await client.get(url)
            _ollama_last_ok = resp.status_code == 200
    except Exception:
        _ollama_last_ok = False
    return _ollama_last_ok


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS poems (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                generation INTEGER NOT NULL,
                status TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS fragment_pool (
                id TEXT PRIMARY KEY,
                fragment TEXT NOT NULL,
                source_poem_id TEXT NOT NULL,
                source_lang TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS queue_logs (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                payload TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        # Migration: add source_lang if fragment_pool existed without it
        try:
            await db.execute("ALTER TABLE fragment_pool ADD COLUMN source_lang TEXT NOT NULL DEFAULT 'unknown'")
        except Exception:
            pass
        # Migration: add source_type/source_id to poems if missing
        try:
            await db.execute("ALTER TABLE poems ADD COLUMN source_type TEXT NOT NULL DEFAULT 'user'")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE poems ADD COLUMN source_id TEXT")
        except Exception:
            pass
        await db.commit()


async def log_queue_event(event_type: str, message: str, payload: dict | None = None) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO queue_logs (id, event_type, message, payload, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                event_type,
                message,
                json.dumps(payload or {}, ensure_ascii=False),
                created_at,
            ),
        )
        await db.commit()


async def fetch_queue_logs(limit: int = 200) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT event_type, message, payload, created_at
            FROM queue_logs
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    logs = []
    for event_type, message, payload, created_at in rows:
        try:
            payload_obj = json.loads(payload) if payload else {}
        except Exception:
            payload_obj = {}
        logs.append(
            {
                "event_type": event_type,
                "message": message,
                "payload": payload_obj,
                "created_at": created_at,
            }
        )
    return logs


async def fetch_queue_logs_grouped(limit: int = 200) -> dict:
    logs = await fetch_queue_logs(limit)
    grouped: dict[str, list] = {}
    for log in logs:
        date = log.get("created_at", "")[:10]
        grouped.setdefault(date, []).append(log)
    return grouped


async def poem_exists_source(source_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT 1 FROM poems WHERE source_id = ? LIMIT 1
            """,
            (source_id,),
        )
        row = await cursor.fetchone()
    return row is not None


async def fetch_local_poems_by_source(limit: int = 200) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT text, generation, status, source_type, created_at
            FROM poems
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    grouped: dict[str, list] = {"user": [], "ai": []}
    for text, generation, status, source_type, created_at in rows:
        grouped.setdefault(source_type, []).append(
            {
                "text": text,
                "generation": generation,
                "status": status,
                "created_at": created_at,
            }
        )
    return grouped


def detect_language(text: str) -> str:
    try:
        return detect(text)
    except LangDetectException:
        return "unknown"


async def fetch_netlify_submissions() -> List[dict]:
    if not NETLIFY_SUBMISSIONS_URL or not NETLIFY_ADMIN_PASSWORD:
        return []
    headers = {"Authorization": f"Bearer {NETLIFY_ADMIN_PASSWORD}"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(NETLIFY_SUBMISSIONS_URL, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    submissions = data.get("submissions", []) if isinstance(data, dict) else []
    return submissions[:NETLIFY_FETCH_LIMIT]


async def push_netlify_poem(text: str) -> None:
    if not NETLIFY_SUBMIT_URL:
        return
    payload = {
        "author": "Entropy Engine",
        "lines": [text],
        "source": "ai",
        "language": detect_language(text),
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(NETLIFY_SUBMIT_URL, json=payload)
        resp.raise_for_status()


async def fetch_external_poems() -> List[str]:
    if not FETCH_ENABLED:
        return []
    submissions = await fetch_netlify_submissions()
    poems: List[dict] = []
    for submission in submissions:
        lines = submission.get("lines") or []
        text = " ".join(lines).strip()
        if not text:
            continue
        source_id = submission.get("id") or submission.get("submissionId") or text[:64]
        source_lang = submission.get("language") or detect_language(text)
        poems.append({"text": text, "source_id": source_id, "source_lang": source_lang})
    if poems:
        return poems

    now = datetime.now(timezone.utc).isoformat()
    return [
        {"text": f"{now} the projector hums", "source_id": f"mock-{now}-1", "source_lang": "en"},
        {"text": f"{now} light falls on concrete", "source_id": f"mock-{now}-2", "source_lang": "en"},
    ]


async def insert_poem(
    text: str,
    generation: int,
    status: str,
    source_type: str = "user",
    source_id: str | None = None,
) -> str:
    poem_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO poems (id, text, generation, status, source_type, source_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (poem_id, text, generation, status, source_type, source_id, created_at),
        )
        await db.commit()
    return poem_id


async def insert_fragments(poem_id: str, fragments: Iterable[str], source_lang: str = "unknown") -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        for fragment in fragments:
            await db.execute(
                """
                INSERT INTO fragment_pool (id, fragment, source_poem_id, source_lang, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), fragment, poem_id, source_lang, created_at),
            )
        await db.commit()


async def fetch_random_fragments_by_lang(limit: int = 200) -> List[Tuple[str, str]]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT fragment, source_lang FROM fragment_pool
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    return [(row[0], row[1]) for row in rows]


async def fetch_random_fragments(limit: int = 5) -> List[str]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT fragment FROM fragment_pool
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    return [row[0] for row in rows]


async def lock_next_pending() -> Optional[Tuple[str, str, int]]:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("BEGIN IMMEDIATE")
        cursor = await db.execute(
            """
            SELECT id, text, generation
            FROM poems
            WHERE status = 'pending'
            ORDER BY created_at
            LIMIT 1
            """
        )
        row = await cursor.fetchone()
        if not row:
            await db.execute("COMMIT")
            return None
        poem_id, text, generation = row
        cursor = await db.execute(
            """
            UPDATE poems
            SET status = 'processing'
            WHERE id = ? AND status = 'pending'
            """,
            (poem_id,),
        )
        await db.commit()
        if cursor.rowcount == 0:
            return None
        return poem_id, text, generation


def pick_soft_mixed_fragments(fragment_pairs: List[Tuple[str, str]]) -> List[str]:
    if not fragment_pairs:
        return []

    buckets: dict[str, List[str]] = {}
    for fragment, lang in fragment_pairs:
        if not fragment:
            continue
        buckets.setdefault(lang or "unknown", []).append(fragment)

    languages = [lang for lang in buckets.keys() if buckets[lang]]
    if not languages:
        return []

    if random.random() > MIX_PROB or len(languages) < 2:
        main_lang = random.choice(languages)
        main_count = min(len(buckets[main_lang]), random.randint(MIX_MAIN_MIN, MIX_MAIN_MAX))
        return random.sample(buckets[main_lang], k=main_count)

    num_langs = min(len(languages), random.randint(MIX_MIN_LANGS, MIX_MAX_LANGS))
    chosen_langs = random.sample(languages, k=num_langs)
    main_lang = chosen_langs[0]
    main_count = min(len(buckets[main_lang]), random.randint(MIX_MAIN_MIN, MIX_MAIN_MAX))
    selected = random.sample(buckets[main_lang], k=main_count)

    for lang in chosen_langs[1:]:
        count = min(len(buckets[lang]), random.randint(MIX_SECONDARY_MIN, MIX_SECONDARY_MAX))
        selected.extend(random.sample(buckets[lang], k=count))

    random.shuffle(selected)
    return selected


async def mark_completed(poem_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE poems SET status = 'completed'
            WHERE id = ?
            """,
            (poem_id,),
        )
        await db.commit()


async def mark_pending(poem_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE poems SET status = 'pending'
            WHERE id = ?
            """,
            (poem_id,),
        )
        await db.commit()


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        payload = json.dumps(message, ensure_ascii=False)
        for connection in list(self._connections):
            try:
                await connection.send_text(payload)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


async def fetcher_loop() -> None:
    while True:
        try:
            poems = await fetch_external_poems()
            inserted = 0
            for poem in poems:
                source_id = poem.get("source_id")
                if source_id and await poem_exists_source(source_id):
                    continue
                poem_id = await insert_poem(
                    text=poem["text"],
                    generation=0,
                    status="pending",
                    source_type="user",
                    source_id=source_id,
                )
                fragments = tokenize_text(poem["text"])
                await insert_fragments(poem_id, fragments, poem.get("source_lang", "unknown"))
                inserted += 1
            if inserted:
                await log_queue_event("fetch", f"Fetched {inserted} poems", {"count": inserted})
            logger.info("Fetcher inserted %d poems", inserted)
        except Exception as exc:
            logger.error("Fetcher loop error: %s", exc)
            await log_queue_event("fetch_error", "Fetcher loop error", {"error": str(exc)})
        await asyncio.sleep(FETCH_INTERVAL_SECONDS)


async def entropy_loop() -> None:
    while True:
        try:
            locked = await lock_next_pending()
            if not locked:
                await asyncio.sleep(ENTROPY_INTERVAL_SECONDS)
                continue
            poem_id, text, generation = locked

            if generation <= MAX_GENERATION:
                fragments = tokenize_text(text)
                await insert_fragments(poem_id, fragments)

            fragment_pairs = await fetch_random_fragments_by_lang(limit=200)
            picked = pick_soft_mixed_fragments(fragment_pairs)
            if not picked:
                picked = await fetch_random_fragments(limit=8)
            if not picked:
                picked = tokenize_text(text)

            try:
                if await ollama_available():
                    new_text = await generate_llm_poem(picked)
                    await log_queue_event("llm_used", "Ollama generation used", {"fragments": picked})
                else:
                    await log_queue_event("llm_unavailable", "Ollama not available; deferred", {})
                    await mark_pending(poem_id)
                    await asyncio.sleep(ENTROPY_INTERVAL_SECONDS)
                    continue
            except Exception as exc:
                logger.warning("LLM generation failed, fallback to stitch: %s", exc)
                await log_queue_event("llm_error", "LLM generation failed; fallback", {"error": str(exc)})
                new_text = stitch_text(random.sample(picked, k=min(3, len(picked))))
            new_generation = generation + 1
            await insert_poem(new_text, new_generation, "pending", source_type="ai")
            await push_netlify_poem(new_text)
            await mark_completed(poem_id)
            await log_queue_event(
                "entropy",
                "Entropy loop processed poem",
                {"poem_id": poem_id, "new_generation": new_generation},
            )

            await manager.broadcast(
                {
                    "text": new_text,
                    "generation": new_generation,
                    "source_text": text,
                }
            )
            logger.info("Entropy loop generated gen=%s", new_generation)
        except Exception as exc:
            logger.error("Entropy loop error: %s", exc)
            await log_queue_event("entropy_error", "Entropy loop error", {"error": str(exc)})
        await asyncio.sleep(ENTROPY_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    fetcher_task = asyncio.create_task(fetcher_loop())
    entropy_task = asyncio.create_task(entropy_loop())
    yield
    fetcher_task.cancel()
    entropy_task.cancel()
    await asyncio.gather(fetcher_task, entropy_task, return_exceptions=True)


app = FastAPI(title="Entropy Loop Backend", lifespan=lifespan)


@app.websocket("/ws/visuals")
async def visuals_ws(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
