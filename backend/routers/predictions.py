"""
FilmIQ — Predictions Router
POST /api/predict/box-office  → full CNN-C prediction with Claude AI analysis
POST /api/predict/opening     → opening weekend only
GET  /api/predict/history     → user's past 20 predictions
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import httpx

from database import get_db
from models import Prediction, User
from auth_utils import get_current_user
from config import settings

router = APIRouter()

# Lazy-load predictor: avoids importing heavy ML deps at module import time
# and avoids sys.path issues before __init__.py has run
_predictor = None


def get_predictor():
    global _predictor
    if _predictor is None:
        from ml.predictor import FilmIQPredictor
        _predictor = FilmIQPredictor()
    return _predictor


# ── Schemas ───────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    title:             str             = Field(..., example="The Last King of Uganda")
    budget:            float           = Field(..., gt=0, example=5_000_000)
    genre:             str             = Field(..., example="Action")
    director_score:    float           = Field(default=0.7, ge=0.0, le=1.0)
    cast_score:        float           = Field(default=0.6, ge=0.0, le=1.0)
    season:            str             = Field(default="general")
    market:            str             = Field(default="pan_african")
    logline:           Optional[str]   = None
    intended_audience: Optional[int]   = None
    heat_index:        Optional[float] = None
    sentiment_score:   Optional[float] = None
    is_ip_adaptation:  bool            = False
    runtime:           Optional[int]   = None


class PredictResponse(BaseModel):
    title:                     str
    predicted_revenue:         float
    predicted_opening_weekend: float
    predicted_roi:             float
    confidence:                float
    model_used:                str
    genre_multiplier:          float
    cast_multiplier:           float
    seasonal_multiplier:       float
    sentiment_boost:           float
    risk_level:                str
    ai_analysis:               Optional[str]
    recommendation:            str
    breakdown:                 dict


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/box-office", response_model=PredictResponse)
async def predict_box_office(
    req: PredictRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = get_predictor().predict(req.model_dump())

    if req.logline and settings.anthropic_api_key:
        result["ai_analysis"] = await _get_claude_analysis(req, result)

    pred = Prediction(
        user_id=current_user.id,
        input_budget=req.budget,
        input_genre=req.genre,
        input_director_score=req.director_score,
        input_cast_score=req.cast_score,
        input_season=req.season,
        input_market=req.market,
        input_logline=req.logline,
        predicted_revenue=result["predicted_revenue"],
        predicted_opening_weekend=result["predicted_opening_weekend"],
        predicted_roi=result["predicted_roi"],
        confidence_score=result["confidence"],
        model_used=result["model_used"],
        genre_multiplier=result["genre_multiplier"],
        sentiment_boost=result["sentiment_boost"],
        seasonal_multiplier=result["seasonal_multiplier"],
        cast_multiplier=result["cast_multiplier"],
        ai_analysis=result.get("ai_analysis"),
        risk_level=result.get("risk_level", "MODERATE"),
    )
    db.add(pred)
    await db.commit()
    return result


@router.post("/opening")
async def predict_opening_weekend(
    req: PredictRequest,
    current_user: User = Depends(get_current_user),
):
    result = get_predictor().predict(req.model_dump())
    return {
        "predicted_opening_weekend": result["predicted_opening_weekend"],
        "confidence":                result["confidence"],
        "risk_level":                result["risk_level"],
    }


@router.get("/history", response_model=List[dict])
async def prediction_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Prediction)
        .where(Prediction.user_id == current_user.id)
        .order_by(desc(Prediction.created_at))
        .limit(20)
    )
    preds = result.scalars().all()
    return [
        {
            "id":                p.id,
            "title":             p.input_logline[:40] if p.input_logline else "Untitled",
            "genre":             p.input_genre,
            "budget":            p.input_budget,
            "predicted_revenue": p.predicted_revenue,
            "predicted_roi":     p.predicted_roi,
            "risk_level":        p.risk_level or "MODERATE",
            "created_at":        str(p.created_at),
        }
        for p in preds
    ]


# ── Claude AI analysis helper ─────────────────────────────────────────────────
async def _get_claude_analysis(req: PredictRequest, result: dict) -> str:
    """Call Claude API server-side (API key never exposed to browser)."""
    prompt = (
        f'Film: "{req.title}" | Budget: ${req.budget:,.0f} | Genre: {req.genre}\n'
        f"Market: {req.market} | Season: {req.season}\n"
        f"Logline: {req.logline}\n"
        f"Prediction: ${result['predicted_revenue']:,.0f} revenue, "
        f"{result['predicted_roi']:.0f}% ROI\n\n"
        "Provide 3 brief bullet points for an African filmmaker/investor:\n"
        "1. Market opportunity in Africa\n"
        "2. Biggest risk factor\n"
        "3. One recommendation to improve box office\n"
        "Maximum 120 words total. Be specific."
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type":      "application/json",
                },
                json={
                    "model":      settings.anthropic_model,
                    "max_tokens": 300,
                    "messages":   [{"role": "user", "content": prompt}],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["content"][0]["text"]
    except Exception:
        pass
    return ""
