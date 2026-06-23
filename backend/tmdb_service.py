"""
FilmIQ — TMDb Service
Fetches movie images/metadata from The Movie Database (TMDb) API.

Security: the API key is read exclusively from `config.settings` (which in turn
reads it from the TMDB_API_KEY environment variable). It is never hardcoded and
never forwarded to the frontend — only the resulting image URLs are.

Caching: successful responses are cached in-process for TMDB_CACHE_TTL_SECS;
failures are negative-cached briefly so a missing/invalid key or a TMDb outage
doesn't cause a request storm. Concurrent requests for the same movie id are
de-duplicated via a per-id asyncio.Lock so only one HTTP call is ever in flight.
"""

import asyncio
import logging
import time
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger("filmiq.tmdb")

_CACHE_TTL_SECS    = 6 * 60 * 60   # 6h — TMDb metadata rarely changes intra-day
_NEGATIVE_TTL_SECS = 5 * 60        # 5m — back off quickly after a failed lookup

# TMDb's free tier allows ~40 req / 10s. get_many() can be asked for up to 100
# ids at once (page-sized movie lists) — bound concurrency so a single page
# render never bursts past that limit.
_MAX_CONCURRENT_REQUESTS = 15
_MAX_RETRIES = 2

_cache: dict[int, tuple[float, Optional[dict]]] = {}
_locks: dict[int, asyncio.Lock] = {}
_client: Optional[httpx.AsyncClient] = None
_semaphore: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_MAX_CONCURRENT_REQUESTS)
    return _semaphore


def is_configured() -> bool:
    return bool(settings.tmdb_api_key)


def build_poster_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    return f"{settings.tmdb_image_base_url}{path}"


def build_backdrop_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    return f"{settings.tmdb_backdrop_base_url}{path}"


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=settings.tmdb_base_url, timeout=httpx.Timeout(6.0))
    return _client


def _auth_params_and_headers() -> tuple[dict, dict]:
    """TMDb supports a v3 query-string api_key OR a v4 Bearer read token (JWT)."""
    key = settings.tmdb_api_key
    if key.count(".") == 2:  # looks like a JWT v4 access token
        return {}, {"Authorization": f"Bearer {key}"}
    return {"api_key": key}, {}


async def get_movie_details(tmdb_id: Optional[int]) -> Optional[dict[str, Any]]:
    """
    Fetch (and cache) poster_path, backdrop_path, overview, release_date,
    vote_average, and genres for a single TMDb movie id. Returns None when
    the key isn't configured, the id is missing, or the lookup fails.
    """
    if not tmdb_id or not is_configured():
        return None

    now = time.monotonic()
    cached = _cache.get(tmdb_id)
    if cached is not None:
        ts, value = cached
        ttl = _CACHE_TTL_SECS if value is not None else _NEGATIVE_TTL_SECS
        if now - ts < ttl:
            return value

    lock = _locks.setdefault(tmdb_id, asyncio.Lock())
    async with lock:
        # Another caller may have populated the cache while we waited on the lock.
        cached = _cache.get(tmdb_id)
        if cached is not None:
            ts, value = cached
            ttl = _CACHE_TTL_SECS if value is not None else _NEGATIVE_TTL_SECS
            if time.monotonic() - ts < ttl:
                return value

        result = await _fetch(tmdb_id)
        _cache[tmdb_id] = (time.monotonic(), result)
        return result
    # Note: the lock entry is intentionally left in `_locks` — it's tiny and
    # reused on the next lookup for this id, avoiding repeated allocation.


async def _fetch(tmdb_id: int) -> Optional[dict[str, Any]]:
    params, headers = _auth_params_and_headers()
    client = _get_client()

    async with _get_semaphore():
        for attempt in range(_MAX_RETRIES + 1):
            try:
                resp = await client.get(
                    f"/movie/{tmdb_id}",
                    params={**params, "language": "en-US"},
                    headers=headers,
                )
                # 429 (rate limited) and 5xx are transient — worth a retry with
                # backoff. 404 (unknown id) and other 4xx are not.
                if resp.status_code == 429 or resp.status_code >= 500:
                    if attempt < _MAX_RETRIES:
                        retry_after = float(resp.headers.get("Retry-After", 0.5 * (attempt + 1)))
                        await asyncio.sleep(retry_after)
                        continue
                resp.raise_for_status()
                data = resp.json()
                poster_path   = data.get("poster_path")
                backdrop_path = data.get("backdrop_path")
                return {
                    "tmdb_id":       tmdb_id,
                    "poster_path":   poster_path,
                    "backdrop_path": backdrop_path,
                    "poster_url":    build_poster_url(poster_path),
                    "backdrop_url":  build_backdrop_url(backdrop_path),
                    "overview":      data.get("overview") or None,
                    "release_date":  data.get("release_date") or None,
                    "vote_average":  data.get("vote_average"),
                    "genres":        [g["name"] for g in data.get("genres", []) if g.get("name")],
                }
            except Exception as exc:
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                logger.warning("TMDb lookup failed for movie_id=%s: %s", tmdb_id, exc)
                return None
    return None


async def get_many(tmdb_ids: list[int]) -> dict[int, Optional[dict[str, Any]]]:
    """Fetch details for several movie ids concurrently (cache + lock dedup applies per id)."""
    ids = [i for i in dict.fromkeys(tmdb_ids) if i]  # dedupe, preserve order, drop falsy
    results = await asyncio.gather(*(get_movie_details(i) for i in ids))
    return dict(zip(ids, results))
