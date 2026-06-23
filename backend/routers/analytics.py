"""
FilmIQ — Analytics Router (real dataset edition)
Every endpoint here is computed from the real 4,803-movie dataset
(backend/movie_dataset.py) — no fabricated constants, no random sampling.
"""

from fastapi import APIRouter, Query
from typing import Optional

import movie_dataset
import tmdb_service
import analytics_service

router = APIRouter()


# ─── Dashboard KPIs (Feature 1) ───────────────────────────────────────────────
@router.get("/dashboard")
async def dashboard_kpis():
    return movie_dataset.dashboard_stats()


# ─── Genre Analytics (Feature 2) ──────────────────────────────────────────────
@router.get("/genre-analytics")
async def genre_analytics():
    return movie_dataset.genre_analytics()


@router.get("/genre-performance")
async def genre_performance():
    """Legacy alias kept for the existing Analytics Studio page."""
    return movie_dataset.genre_analytics()


@router.get("/genres")
async def genres():
    """Alias of /genre-analytics with the conventional resource-name path."""
    return movie_dataset.genre_analytics()


@router.get("/directors")
async def directors(limit: int = Query(20, le=50)):
    return movie_dataset.people_analytics(limit=limit)["top_directors"]


@router.get("/cast")
async def cast(limit: int = Query(20, le=50)):
    return movie_dataset.people_analytics(limit=limit)["top_actors"]


@router.get("/countries")
async def countries():
    """Country breakdown — real `production_countries` field, not available
    under the previous dataset."""
    return movie_dataset.country_distribution()


@router.get("/popularity")
async def popularity(limit: int = Query(20, le=100)):
    """Most-popular films by TMDb popularity score, with genre/year context."""
    df = movie_dataset.get_df()
    top = df.sort_values("popularity", ascending=False).head(limit)
    return [
        {
            "id": int(r["id"]), "title": r["title"], "popularity": float(r["popularity"]),
            "vote_average": float(r["vote_average"]), "vote_count": int(r["vote_count"]),
            "year": movie_dataset._clean(r["year"]), "genres": r["genres"],
        }
        for _, r in top.iterrows()
    ]


# ─── Trend Explorer (Feature 5) ───────────────────────────────────────────────
@router.get("/trends")
async def trends():
    return movie_dataset.trends()


@router.get("/year-trend")
async def year_trend():
    return movie_dataset.dashboard_stats()["year_trend"]


@router.get("/seasonal")
async def seasonal_performance():
    return movie_dataset.seasonal_performance()


@router.get("/language")
async def language_distribution():
    return movie_dataset.language_distribution()


@router.get("/scatter")
async def budget_revenue_scatter(genre: Optional[str] = None, limit: int = Query(200, le=500)):
    return movie_dataset.budget_revenue_scatter(genre=genre, limit=limit)


# ─── Actor & Director Analytics (Feature 6) ───────────────────────────────────
@router.get("/people")
async def people_analytics(limit: int = Query(20, le=50)):
    return movie_dataset.people_analytics(limit=limit)


@router.get("/top-directors")
async def top_directors(limit: int = Query(10, le=50)):
    return movie_dataset.people_analytics(limit=limit)["top_directors"]


@router.get("/filmography")
async def filmography(person: str, role: str = Query("director", pattern="^(director|actor)$")):
    return movie_dataset.filmography(person, role)


# ─── AI Insights (Feature 9) ──────────────────────────────────────────────────
@router.get("/insights")
async def insights():
    return {"insights": movie_dataset.insights()}


# ─── Executive Overview (Feature 10) ──────────────────────────────────────────
@router.get("/overview")
async def overview():
    data = movie_dataset.overview()
    tmdb_ids = [m["tmdb_id"] for m in data["trending"] if m.get("tmdb_id")]
    details_by_id = await tmdb_service.get_many(tmdb_ids)
    for m in data["trending"]:
        details = details_by_id.get(m.get("tmdb_id"))
        m["poster_url"]   = details["poster_url"]   if details else None
        m["backdrop_url"] = details["backdrop_url"] if details else None
    return data


# ─── Model Accuracy Comparison (real ML training artifact, unchanged) ─────────
@router.get("/model-accuracy")
async def model_accuracy():
    return analytics_service.model_accuracy()
