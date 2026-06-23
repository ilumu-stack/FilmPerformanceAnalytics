"""
FilmIQ — Movies Router (real dataset edition)
Serves the real 4,803-movie TMDb dataset (backend/movie_dataset.py), enriched
with live poster/backdrop images from TMDb where available (free API).
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

import movie_dataset
import tmdb_service

router = APIRouter()


# ─── List & Filter (Search Intelligence) ──────────────────────────────────────
@router.get("/", response_model=List[dict])
async def list_movies(
    page:           int   = Query(1, ge=1),
    limit:          int   = Query(20, le=100),
    genre:          Optional[str]   = None,
    year_from:      Optional[int]   = None,
    year_to:        Optional[int]   = None,
    min_rating:     Optional[float] = None,
    max_rating:     Optional[float] = None,
    min_popularity: Optional[float] = None,
    max_popularity: Optional[float] = None,
    min_runtime:    Optional[int]   = None,
    max_runtime:    Optional[int]   = None,
    sort:           str   = Query("revenue", pattern="^(revenue|budget|roi|vote_average|popularity)$"),
):
    rows, _total = movie_dataset.list_movies(
        page=page, limit=limit, genre=genre,
        year_from=year_from, year_to=year_to,
        min_rating=min_rating, max_rating=max_rating,
        min_popularity=min_popularity, max_popularity=max_popularity,
        min_runtime=min_runtime, max_runtime=max_runtime,
        sort=sort,
    )
    enriched = await _enrich_many(rows)
    return [_strip_detail(m) for m in enriched]


@router.get("/featured")
async def featured_movies(limit: int = Query(5, le=10)):
    """Top films with backdrop imagery — used for landing-page hero / trending rails."""
    rows = movie_dataset.featured_movies(limit)
    enriched = await _enrich_many(rows)
    return [_strip_detail(m) for m in enriched]


@router.get("/top")
async def top_movies(limit: int = Query(10, le=50), genre: Optional[str] = None):
    rows = movie_dataset.top_movies(limit=limit, genre=genre)
    enriched = await _enrich_many(rows)
    return [_strip_detail(m) for m in enriched]


@router.get("/search")
async def search_movies(q: str = Query(..., min_length=2), limit: int = Query(10, le=50)):
    rows = movie_dataset.search_movies(q, limit)
    enriched = await _enrich_many(rows)
    return [_strip_detail(m) for m in enriched]


@router.get("/compare")
async def compare_movies(ids: str = Query(..., description="Comma-separated movie ids, 2-5")):
    try:
        id_list = [int(x) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "ids must be a comma-separated list of integers")
    if not (2 <= len(id_list) <= 5):
        raise HTTPException(400, "Provide between 2 and 5 movie ids to compare")

    rows = movie_dataset.get_many_by_ids(id_list)
    if len(rows) != len(id_list):
        raise HTTPException(404, "One or more movies not found")
    enriched = await _enrich_many(rows)
    return enriched


@router.get("/{movie_id}")
async def get_movie(movie_id: int):
    movie = movie_dataset.get_movie(movie_id)
    if not movie:
        raise HTTPException(404, "Movie not found")
    enriched = await _enrich_one(movie)
    enriched["trend_metrics"] = movie_dataset.trend_metrics(movie_id)
    return enriched


@router.get("/{movie_id}/similar")
async def get_similar_movies(movie_id: int, limit: int = Query(10, le=20)):
    if not movie_dataset.get_movie(movie_id):
        raise HTTPException(404, "Movie not found")
    rows = movie_dataset.similar_movies(movie_id, limit)
    enriched = await _enrich_many(rows)
    return [_strip_detail(m, keep=["similarity_score"]) for m in enriched]


@router.get("/{movie_id}/recommendations")
async def get_recommendations(movie_id: int, limit: int = Query(10, le=20)):
    """Alias of /similar — "similarity_score" doubles as recommendation confidence."""
    return await get_similar_movies(movie_id, limit)


@router.get("/{movie_id}/images")
async def get_movie_images(movie_id: int):
    movie = movie_dataset.get_movie(movie_id)
    if not movie:
        raise HTTPException(404, "Movie not found")
    details = await tmdb_service.get_movie_details(movie.get("tmdb_id"))
    return {
        "id":           movie_id,
        "poster_url":   details["poster_url"]   if details else None,
        "backdrop_url": details["backdrop_url"] if details else None,
    }


@router.get("/{movie_id}/cast")
async def get_movie_cast(movie_id: int):
    """Cast/director come from the dataset (source of truth) — TMDb is never
    used to override or supplement these, only images/overview."""
    movie = movie_dataset.get_movie(movie_id)
    if not movie:
        raise HTTPException(404, "Movie not found")
    return {"id": movie_id, "director": movie.get("director"), "cast": movie.get("cast")}


# ─── TMDb enrichment ──────────────────────────────────────────────────────────
async def _enrich_one(movie: dict) -> dict:
    enriched = {**movie, "poster_url": None, "backdrop_url": None}
    details = await tmdb_service.get_movie_details(movie.get("tmdb_id"))
    if details:
        enriched["poster_url"]   = details["poster_url"]
        enriched["backdrop_url"] = details["backdrop_url"]
        enriched["overview"] = enriched.get("overview") or details.get("overview")
    return enriched


async def _enrich_many(movies: List[dict]) -> List[dict]:
    tmdb_ids = [m.get("tmdb_id") for m in movies if m.get("tmdb_id")]
    details_by_id = await tmdb_service.get_many(tmdb_ids)

    enriched = []
    for m in movies:
        details = details_by_id.get(m.get("tmdb_id"))
        item = {**m, "poster_url": None, "backdrop_url": None}
        if details:
            item["poster_url"]   = details["poster_url"]
            item["backdrop_url"] = details["backdrop_url"]
            item["overview"] = item.get("overview") or details.get("overview")
        enriched.append(item)
    return enriched


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _strip_detail(m: dict, keep: Optional[List[str]] = None) -> dict:
    """List/search views don't need the heavier per-movie fields."""
    drop = {"cast", "production_companies", "production_countries", "tmdb_id"}
    if keep:
        drop -= set(keep)
    return {k: v for k, v in m.items() if k not in drop}
