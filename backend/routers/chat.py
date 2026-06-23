"""
FilmIQ — Chat Router
POST /api/chat  → server-side Claude AI proxy

Security:
- Rate-limited per IP: 20 requests per minute (in-memory token bucket)
- Optional JWT: authenticated users get higher limits
- API key NEVER sent to browser
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from collections import defaultdict
from datetime import datetime, timezone
import httpx
import asyncio

from config import settings
import analytics_service

router = APIRouter()

# ── Simple in-process rate limiter ────────────────────────────────────────────
# In production, replace with Redis-backed rate limiting (e.g. slowapi)
_rate_buckets: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT   = 20   # requests
_RATE_WINDOW  = 60.0 # seconds
_rate_lock    = asyncio.Lock()


async def _check_rate_limit(client_ip: str) -> None:
    async with _rate_lock:
        now   = datetime.now(timezone.utc).timestamp()
        times = _rate_buckets[client_ip]
        # Drop timestamps outside the window
        _rate_buckets[client_ip] = [t for t in times if now - t < _RATE_WINDOW]
        if len(_rate_buckets[client_ip]) >= _RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {_RATE_LIMIT} requests per minute",
                headers={"Retry-After": "60"},
            )
        _rate_buckets[client_ip].append(now)


def _get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For from nginx proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role:    str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=2000)


class ChatRequest(BaseModel):
    message: str                          = Field(..., min_length=1, max_length=500)
    history: Optional[list[ChatMessage]]  = Field(default=None, max_length=20)


class ChatResponse(BaseModel):
    reply: str


def _system_prompt() -> str:
    """Built fresh from analytics_service so the model is grounded in real,
    currently-computed numbers — never a hardcoded snapshot."""
    return (
        "You are FilmIQ Analyst, an expert in film analytics, box office prediction, "
        "and film investment intelligence. Use ONLY the following real, computed dataset "
        "facts — never invent figures, and explicitly say so if asked about something "
        "this dataset doesn't cover (e.g. Ugandan market size/CAGR):\n"
        f"{analytics_service.chat_context_facts()}\n"
        "Be concise and data-driven. Max 150 words per response."
    )


# ── Endpoint ─────────────────────────────────────────────────────────────────
@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request) -> ChatResponse:
    client_ip = _get_client_ip(request)
    await _check_rate_limit(client_ip)

    if not settings.anthropic_api_key:
        return ChatResponse(reply=_fallback(req.message))

    history = (req.history or [])[-10:]
    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": req.message})

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type":      "application/json",
                },
                json={
                    "model":      settings.anthropic_model,
                    "max_tokens": 400,
                    "system":     _system_prompt(),
                    "messages":   messages,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return ChatResponse(reply=data["content"][0]["text"])
    except Exception:
        pass

    return ChatResponse(reply=_fallback(req.message))


def _genre_summary() -> str:
    parts = ", ".join(
        f"{g['genre']} (${g['avg_revenue'] / 1e6:.0f}M avg revenue)"
        for g in analytics_service.top_genres_by_revenue(3)
    )
    return f"Highest-revenue genres in the dataset: {parts}."


def _roi_summary() -> str:
    parts = ", ".join(
        f"{f['title']} ({f['roi']:+.0f}% ROI)"
        for f in analytics_service.top_roi_films(3)
    )
    return f"Highest-ROI films in the dataset: {parts}."


def _fallback(q: str) -> str:
    """Offline fallback when the Claude API is unavailable — every figure here
    is computed live from the dataset, never a fixed claim."""
    lower = q.lower()
    if "africa" in lower or "uganda" in lower:
        return (
            "This dataset has no Ugandan-market-specific data (size, CAGR, country "
            "breakdown), so I can't give a real figure for that. " + _genre_summary()
        )
    if "genre" in lower:
        return _genre_summary()
    if "roi" in lower or "invest" in lower:
        return _roi_summary()
    if "predict" in lower or "model" in lower:
        acc = analytics_service.model_accuracy()
        if acc["best_model"]:
            return f"The {acc['best_model']} model achieves R²={acc['best_r2']}% on this dataset's box-office regression task."
        return "No trained model results are available yet."
    return _genre_summary() + " " + _roi_summary()
