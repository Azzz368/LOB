import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

import psycopg
import redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from langdetect import detect, detect_langs
from langdetect.lang_detect_exception import LangDetectException
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("ingest-service")

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "86400"))

app = FastAPI(title="Library of Babel Ingest")


class IngestRequest(BaseModel):
    text: str = Field(..., description="Raw poem text")
    source: Optional[str] = Field(default=None)
    client_ts: Optional[float] = Field(default=None)


class IngestResponse(BaseModel):
    id: str
    text: str
    lang_code: str
    confidence: float
    created_at: str
    source: Optional[str]


def detect_language(text: str) -> Tuple[str, float]:
    trimmed = text.strip()
    if len(trimmed) < 2:
        return "unknown", 0.0

    try:
        langs = detect_langs(trimmed)
        if not langs:
            return "unknown", 0.0
        top = langs[0]
        return detect(trimmed), float(top.prob)
    except LangDetectException:
        return "unknown", 0.0
    except Exception as exc:  # pragma: no cover - safety fallback
        logger.warning("language detection failed: %s", exc)
        return "unknown", 0.0


def ensure_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS raw_poems (
                id UUID PRIMARY KEY,
                text TEXT NOT NULL,
                lang_code VARCHAR(16),
                confidence FLOAT,
                source VARCHAR(64),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.commit()


def insert_raw_poem(
    poem_id: str,
    text: str,
    lang_code: str,
    confidence: float,
    source: Optional[str],
    created_at: datetime,
) -> None:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")

    with psycopg.connect(DATABASE_URL) as conn:
        ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO raw_poems (id, text, lang_code, confidence, source, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (poem_id, text, lang_code, confidence, source, created_at),
            )
        conn.commit()


def cache_poem(payload: dict) -> None:
    if not REDIS_URL:
        logger.info("REDIS_URL not configured, skip redis cache")
        return

    try:
        client = redis.Redis.from_url(REDIS_URL)
        key = f"poem:{payload['id']}"
        client.set(name=key, value=json.dumps(payload, ensure_ascii=False), ex=REDIS_TTL_SECONDS)
    except Exception as exc:
        logger.warning("redis cache failed: %s", exc)


@app.post("/ingest", response_model=IngestResponse)
def ingest_poem(request: IngestRequest) -> IngestResponse:
    text = request.text.strip() if request.text else ""
    if not text:
        logger.info("reject empty text")
        raise HTTPException(status_code=400, detail="text is required")

    lang_code, confidence = detect_language(text)
    poem_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)
    source = request.source or "local"

    try:
        insert_raw_poem(
            poem_id=poem_id,
            text=text,
            lang_code=lang_code,
            confidence=confidence,
            source=source,
            created_at=created_at,
        )
        logger.info("poem stored in postgres: %s", poem_id)
    except Exception as exc:
        logger.error("postgres insert failed: %s", exc)
        raise HTTPException(status_code=500, detail="database insert failed") from exc

    payload = {
        "id": poem_id,
        "text": text,
        "lang_code": lang_code,
        "confidence": confidence,
        "created_at": created_at.isoformat(),
        "source": source,
    }

    cache_poem(payload)

    return IngestResponse(**payload)
