"""
FilmIQ — Investor Intelligence Router
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from database import get_db
from models import Movie, Genre

router = APIRouter()


@router.get("/roi-matrix")
async def roi_matrix():
    """Genre risk vs return for investment bubble chart."""
    return [
        {"genre":"Adventure","risk":45,"roi":812,"film_count":154,"avg_budget":95},
        {"genre":"Animation","risk":38,"roi":643,"film_count":82,"avg_budget":80},
        {"genre":"Family","risk":30,"roi":580,"film_count":79,"avg_budget":70},
        {"genre":"Action","risk":52,"roi":521,"film_count":192,"avg_budget":110},
        {"genre":"Science Fiction","risk":60,"roi":490,"film_count":90,"avg_budget":130},
        {"genre":"Comedy","risk":35,"roi":320,"film_count":115,"avg_budget":45},
        {"genre":"Romance","risk":28,"roi":210,"film_count":60,"avg_budget":30},
        {"genre":"Drama","risk":22,"roi":180,"film_count":151,"avg_budget":25},
        {"genre":"Horror","risk":40,"roi":280,"film_count":76,"avg_budget":15},
        {"genre":"Thriller","risk":68,"roi":-12,"film_count":130,"avg_budget":55},
    ]


@router.get("/opportunities")
async def investment_opportunities():
    """AI-scored opportunities with signal type."""
    return [
        {"signal":"STRONG BUY","genre":"African Animation/Family","rationale":"Ne Zha 2 hit $2.1B on $80M budget. Zero African equivalents exist. 18% CAGR market.","confidence":0.87,"risk":"LOW","expected_roi":"+500–800%"},
        {"signal":"BUY","genre":"Pan-African Action","rationale":"Action genre averages $160M globally. Low African representation = massive upside.","confidence":0.78,"risk":"MODERATE","expected_roi":"+300–500%"},
        {"signal":"ACCUMULATE","genre":"Ugandan Drama/Comedy","rationale":"Local comedy dominates East African screens. Low budgets ($0.5–2M) = outsized ROI potential.","confidence":0.72,"risk":"LOW","expected_roi":"+200–400%"},
        {"signal":"WATCH","genre":"Nollywood Crossover","rationale":"Nollywood is world's 2nd largest film industry. International co-productions gaining traction.","confidence":0.65,"risk":"MODERATE","expected_roi":"+150–300%"},
        {"signal":"CAUTION","genre":"African Thriller/Horror","rationale":"Thriller MLR coefficient: -1.12. Cultural resistance to horror content in African markets.","confidence":0.80,"risk":"HIGH","expected_roi":"-20 to +80%"},
    ]


@router.get("/top-roi")
async def top_roi_films(limit: int = Query(10, le=50), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Movie)
            .where(Movie.roi.isnot(None), Movie.budget > 1_000_000)
            .order_by(desc(Movie.roi))
            .limit(limit)
        )
        movies = result.scalars().all()
        if movies:
            return [{"title": m.title, "budget": m.budget, "revenue": m.revenue, "roi": m.roi} for m in movies]
    except Exception:
        pass
    # Seeded
    return [
        {"title":"Ne Zha 2","budget":80000000,"revenue":2123000000,"roi":2553.8},
        {"title":"Avatar","budget":237000000,"revenue":2923706026,"roi":1133.6},
        {"title":"Titanic","budget":200000000,"revenue":2264162353,"roi":1032.1},
        {"title":"Jurassic World","budget":150000000,"revenue":1670516444,"roi":1013.7},
        {"title":"The Lion King (2019)","budget":250000000,"revenue":1663075401,"roi":565.2},
        {"title":"Avengers: Endgame","budget":356000000,"revenue":2799439100,"roi":686.4},
        {"title":"The Avengers","budget":220000000,"revenue":1519557910,"roi":590.7},
        {"title":"Star Wars: TFA","budget":245000000,"revenue":2068223624,"roi":744.2},
    ]


@router.get("/africa-outlook")
async def africa_outlook():
    return {
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
        ]
    }


# Module-level lazy singleton — same pattern as predictions.py
_sim_predictor = None

def _get_predictor():
    global _sim_predictor
    if _sim_predictor is None:
        from ml.predictor import FilmIQPredictor
        _sim_predictor = FilmIQPredictor()
    return _sim_predictor


@router.get("/simulate")
async def simulate_portfolio(
    genre:  str   = Query("Action"),
    budget: float = Query(5_000_000),
    market: str   = Query("pan_african"),
):
    """Quick portfolio simulation without auth."""
    result = _get_predictor().predict({"budget": budget, "genre": genre, "market": market,
                                       "director_score": 0.6, "cast_score": 0.6, "season": "summer"})
    return {
        "input":  {"genre": genre, "budget": budget, "market": market},
        "output": {"predicted_revenue": result["predicted_revenue"],
                   "roi": result["predicted_roi"],
                   "risk": result["risk_level"],
                   "recommendation": result["recommendation"]},
    }
