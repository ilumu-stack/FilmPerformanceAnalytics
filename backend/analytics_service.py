"""
FilmIQ — Analytics Service
Shared, reusable facade over movie_dataset.py and ml/training_results.json so
routers (chat, admin, analytics, predictions) read the same real numbers
instead of each keeping its own copy (or, worse, a hardcoded guess).
"""

import json
from pathlib import Path
from typing import Any, Optional

import movie_dataset

# See movie_dataset.py's CSV_PATH comment — same dual-layout issue: ml/ is a
# sibling of this file in the Docker image, but one level up in local dev.
_TRAINING_RESULTS_CANDIDATES = [
    Path(__file__).parent / "ml" / "training_results.json",         # Docker layout
    Path(__file__).parent.parent / "ml" / "training_results.json",  # local dev layout
]
_TRAINING_RESULTS_PATH = next(
    (p for p in _TRAINING_RESULTS_CANDIDATES if p.exists()), _TRAINING_RESULTS_CANDIDATES[0]
)


def model_accuracy() -> dict[str, Any]:
    """Real training-run metrics from ml/training_results.json, or empty if untrained."""
    try:
        data = json.loads(_TRAINING_RESULTS_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"models": [], "best_model": None, "best_r2": None}
    if not data:
        return {"models": [], "best_model": None, "best_r2": None}

    best_name, best = max(data.items(), key=lambda kv: kv[1]["r2"])
    return {
        "models": [
            {
                "name":        name,
                "r2":          round(m["r2"] * 100, 2),
                "mae_dollars": round(m.get("mae_dollars", 0) / 1e6, 1),
            }
            for name, m in data.items()
        ],
        "best_model": best_name,
        "best_r2":    round(best["r2"] * 100, 2),
    }


def top_genres_by_revenue(limit: int = 3) -> list[dict[str, Any]]:
    genres = movie_dataset.genre_analytics()
    return sorted(genres, key=lambda g: g["avg_revenue"], reverse=True)[:limit]


def top_roi_genres(limit: int = 3) -> list[dict[str, Any]]:
    """Real per-genre ROI, already sorted descending by movie_dataset.genre_roi_stats()."""
    return movie_dataset.genre_roi_stats()[:limit]


def top_roi_films(limit: int = 3) -> list[dict[str, Any]]:
    return movie_dataset.top_roi_films(limit=limit)


def chat_context_facts() -> str:
    """
    Plain-text grounding facts for the AI chat system prompt and offline fallback.
    Every number here is computed live from the dataset/training artifact —
    there is no industry-projection or per-country data available, so none is
    claimed here.
    """
    kpis = movie_dataset.dashboard_stats()["kpis"]

    genre_lines = ", ".join(
        f"{g['genre']} (${g['avg_revenue'] / 1e6:.0f}M avg revenue)"
        for g in top_genres_by_revenue(3)
    )
    roi_lines = ", ".join(
        f"{g['genre']} ({g['avg_roi_pct']:+.0f}% avg ROI, {g['film_count']} films)"
        for g in top_roi_genres(3)
    )
    film_lines = ", ".join(
        f"{f['title']} ({f['roi']:+.0f}% ROI)" for f in top_roi_films(3)
    )

    acc = model_accuracy()
    acc_line = (
        f"{acc['best_model']} at R²={acc['best_r2']}%"
        if acc["best_model"] else "not yet trained on this dataset"
    )

    return (
        f"- {kpis['total_films']} films in the dataset; average rating {kpis['avg_rating']:.1f}, "
        f"average ROI {kpis['avg_roi']:+.1f}% across {kpis['films_with_financials']} films with "
        f"complete budget/revenue data\n"
        f"- Highest-revenue genres: {genre_lines}\n"
        f"- Highest-ROI genres: {roi_lines}\n"
        f"- Highest-ROI individual films in the dataset: {film_lines}\n"
        f"- Box-office prediction model accuracy: {acc_line}\n"
        f"- No Ugandan-market-specific data (size, CAGR, country breakdown) exists in this "
        f"dataset — do not state figures for it."
    )
