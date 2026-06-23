"""
FilmIQ — Investor Intelligence Router (Firestore edition)
All endpoints require an authenticated investor (or admin) — see auth_utils.get_current_investor.
"""
from fastapi import APIRouter, Depends, Query

import movie_dataset
from models import User
from auth_utils import get_current_investor

router = APIRouter()


@router.get("/roi-matrix")
async def roi_matrix(_investor: User = Depends(get_current_investor)):
    """Real per-genre ROI and loss-rate, computed from films with budget & revenue data."""
    stats = movie_dataset.genre_roi_stats()
    return [
        {
            "genre":      s["genre"],
            "roi":        s["avg_roi_pct"],
            "risk":       s["loss_rate_pct"],  # % of the genre's films that lost money
            "film_count": s["film_count"],
            "avg_budget": s["avg_budget_musd"],
        }
        for s in stats
    ]


@router.get("/opportunities")
async def investment_opportunities(_investor: User = Depends(get_current_investor)):
    """Investment signals derived from real per-genre ROI/loss-rate — no fabricated rationale."""
    stats = movie_dataset.genre_roi_stats()
    opportunities = []
    for s in stats:
        roi, loss_rate, count = s["avg_roi_pct"], s["loss_rate_pct"], s["film_count"]

        if roi >= 400:
            signal = "STRONG BUY"
        elif roi >= 200:
            signal = "BUY"
        elif roi >= 100:
            signal = "ACCUMULATE"
        elif roi >= 0:
            signal = "WATCH"
        else:
            signal = "CAUTION"

        risk = "LOW" if loss_rate < 20 else "MODERATE" if loss_rate < 40 else "HIGH"
        confidence = round(min(0.95, count / 100), 2)

        opportunities.append({
            "signal":      signal,
            "genre":       s["genre"],
            "rationale": (
                f"{s['genre']} films average {roi}% ROI across {count} titles with "
                f"budget/revenue data; {loss_rate}% finished at a loss."
            ),
            "confidence":   confidence,
            "risk":         risk,
            "expected_roi": f"{roi:+.0f}%",
        })

    order = {"STRONG BUY": 0, "BUY": 1, "ACCUMULATE": 2, "WATCH": 3, "CAUTION": 4}
    opportunities.sort(key=lambda o: order[o["signal"]])
    return opportunities


@router.get("/top-roi")
async def top_roi_films(limit: int = Query(10, le=50), _investor: User = Depends(get_current_investor)):
    """Real highest-ROI films in the dataset (budget and revenue both present)."""
    return movie_dataset.top_roi_films(limit=limit)


@router.get("/africa-outlook")
async def africa_outlook(_investor: User = Depends(get_current_investor)):
    """
    No African-market dataset (size, CAGR, country breakdown, streaming-vs-cinema
    trend) exists anywhere in this repo — the TMDB CSV has no country-of-market or
    distribution-channel data. These figures are external industry estimates, NOT
    computed from movie_dataset.py. Marked explicitly so the frontend doesn't
    present them as live analytics like the other investor endpoints.
    """
    return {
        "data_source": "illustrative_estimate_not_computed",
        "cagr": 18.0,
        "current_market_size_usd": 640_000_000,
        "projected_2030_usd": 2_100_000_000,
        "top_markets": [
            {"country":"Nigeria","market_share":0.38,"growth":22},
            {"country":"South Africa","market_share":0.24,"growth":14},
            {"country":"Kenya","market_share":0.12,"growth":19},
            {"country":"Uganda","market_share":0.07,"growth":21},
            {"country":"Ghana","market_share":0.06,"growth":18},
            {"country":"Other","market_share":0.13,"growth":15},
        ],
        "year_projections": [
            {"year":"2022","value":420},{"year":"2023","value":510},
            {"year":"2024","value":640},{"year":"2025","value":780},
            {"year":"2026","value":950},{"year":"2027","value":1180},
            {"year":"2028","value":1420},{"year":"2029","value":1720},
            {"year":"2030","value":2100},
        ],
        "streaming_vs_cinema": [
            {"year":"2018","cinema":100,"streaming":42},
            {"year":"2019","cinema":115,"streaming":58},
            {"year":"2020","cinema":38,"streaming":95},
            {"year":"2021","cinema":65,"streaming":110},
            {"year":"2022","cinema":88,"streaming":125},
            {"year":"2023","cinema":102,"streaming":140},
            {"year":"2024","cinema":112,"streaming":158},
            {"year":"2025","cinema":118,"streaming":175},
        ],
    }


_sim_predictor = None

def _get_predictor():
    global _sim_predictor
    if _sim_predictor is None:
        from ml.predictor import FilmIQPredictor
        _sim_predictor = FilmIQPredictor()
    return _sim_predictor


@router.get("/simulate")
async def simulate_portfolio(
    genre:          str   = Query("Action"),
    budget:         float = Query(5_000_000),
    market:         str   = Query("pan_african"),
    season:         str   = Query("summer"),
    director_score: float = Query(0.5, ge=0.0, le=1.0),
    cast_score:     float = Query(0.5, ge=0.0, le=1.0),
    _investor:      User  = Depends(get_current_investor),
):
    result = _get_predictor().predict({
        "budget": budget, "genre": genre, "market": market, "season": season,
        "director_score": director_score, "cast_score": cast_score,
    })
    return {
        "input":  {
            "genre": genre, "budget": budget, "market": market, "season": season,
            "director_score": director_score, "cast_score": cast_score,
        },
        "output": {
            "predicted_revenue": result["predicted_revenue"],
            "roi":               result["predicted_roi"],
            "risk":              result["risk_level"],
            "recommendation":    result["recommendation"],
        },
    }
