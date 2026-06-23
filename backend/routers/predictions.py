"""
FilmIQ — Predictions Router (Firestore edition)
POST /api/predict/box-office  → full CNN-C prediction with Claude AI analysis
POST /api/predict/opening     → opening weekend only
GET  /api/predict/history     → user's past 20 predictions
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import httpx
from datetime import datetime, timezone

from firebase_db import db
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from models import User
from auth_utils import get_current_user
from config import settings
from ml.sentiment import analyze_batch

router = APIRouter()

_predictor = None


def get_predictor():
    global _predictor
    if _predictor is None:
        from ml.predictor import FilmIQPredictor
        _predictor = FilmIQPredictor()
    return _predictor


# ── Schemas ───────────────────────────────────────────────────────────────────
class ReviewComment(BaseModel):
    text:        str           = Field(..., max_length=2000)
    days_before: Optional[int] = Field(default=None, ge=1, le=30)


class PredictRequest(BaseModel):
    title:             str           = Field(..., example="The Last King of Uganda")
    budget:            float         = Field(..., gt=0, example=5_000_000)
    genre:             str           = Field(..., example="Action")
    director_score:    float         = Field(default=0.7, ge=0.0, le=1.0)
    cast_score:        float         = Field(default=0.6, ge=0.0, le=1.0)
    season:            str           = Field(default="general")
    market:            str           = Field(default="pan_african")
    logline:           Optional[str] = None
    intended_audience: Optional[int] = None
    heat_index:        Optional[float] = None
    sentiment_score:   Optional[float] = None
    review_comments:   Optional[List[ReviewComment]] = Field(
        default=None,
        description="Raw audience/critic comments. When provided, these are scored by "
                     "ml.sentiment.analyze_batch() and the resulting aggregate score "
                     "REPLACES sentiment_score automatically.",
    )
    is_ip_adaptation:  bool          = False
    runtime:           Optional[int] = None
    movie_id:          Optional[str] = Field(
        default=None,
        description="Firestore filmmaker_movies document id, to link this prediction "
                     "to a specific movie for filmmaker analytics.",
    )


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
    sentiment_analysis:        Optional[dict] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────
def _resolve_sentiment(req: PredictRequest) -> tuple[float, Optional[dict]]:
    """If raw review comments were supplied, score them with the real sentiment
    pipeline and use that aggregate as the effective sentiment_score — this is
    what actually connects ml/sentiment.py to the prediction inputs, rather than
    requiring the caller to pre-compute a sentiment_score themselves."""
    if not req.review_comments:
        return (req.sentiment_score if req.sentiment_score is not None else 0.1), None

    comments = [{"text": c.text, "days_before": c.days_before} for c in req.review_comments]
    analysis = analyze_batch(comments)
    return analysis["aggregate_score"], analysis


@router.post("/box-office", response_model=PredictResponse)
async def predict_box_office(
    req:          PredictRequest,
    current_user: User = Depends(get_current_user),
):
    effective_sentiment, sentiment_analysis = _resolve_sentiment(req)

    predictor_input = req.model_dump()
    predictor_input["sentiment_score"] = effective_sentiment

    result = get_predictor().predict(predictor_input)
    result["sentiment_analysis"] = sentiment_analysis

    if req.logline and settings.anthropic_api_key:
        result["ai_analysis"] = await _get_claude_analysis(req, result)

    # Persist to Firestore
    try:
        doc_ref = db.collection("predictions").document()
        await doc_ref.set({
            "user_id":                    current_user.id,
            "movie_id":                   req.movie_id,
            "input_budget":               req.budget,
            "input_genre":                req.genre,
            "input_director_score":       req.director_score,
            "input_cast_score":           req.cast_score,
            "input_season":               req.season,
            "input_market":               req.market,
            "input_logline":              req.logline,
            "input_sentiment_score":      effective_sentiment,
            "sentiment_analysis":         sentiment_analysis,
            "predicted_revenue":          result["predicted_revenue"],
            "predicted_opening_weekend":  result["predicted_opening_weekend"],
            "predicted_roi":              result["predicted_roi"],
            "confidence_score":           result["confidence"],
            "model_used":                 result["model_used"],
            "genre_multiplier":           result["genre_multiplier"],
            "sentiment_boost":            result["sentiment_boost"],
            "seasonal_multiplier":        result["seasonal_multiplier"],
            "cast_multiplier":            result["cast_multiplier"],
            "ai_analysis":                result.get("ai_analysis"),
            "risk_level":                 result.get("risk_level", "MODERATE"),
            "status":                     "completed",
            "created_at":                 firestore.SERVER_TIMESTAMP,
        })
    except Exception:
        pass  # Prediction result is still returned even if persistence fails

    return result


@router.post("/opening")
async def predict_opening_weekend(
    req:          PredictRequest,
    current_user: User = Depends(get_current_user),
):
    effective_sentiment, _ = _resolve_sentiment(req)
    predictor_input = req.model_dump()
    predictor_input["sentiment_score"] = effective_sentiment
    result = get_predictor().predict(predictor_input)
    return {
        "predicted_opening_weekend": result["predicted_opening_weekend"],
        "confidence":                result["confidence"],
        "risk_level":                result["risk_level"],
    }


@router.get("/history", response_model=List[dict])
async def prediction_history(current_user: User = Depends(get_current_user)):
    try:
        docs = (
            await db.collection("predictions")
            .where(filter=FieldFilter("user_id", "==", current_user.id))
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(20)
            .get()
        )
        return [
            {
                "id":                doc.id,
                "title":             (doc.to_dict().get("input_logline") or "Untitled")[:40],
                "genre":             doc.to_dict().get("input_genre"),
                "budget":            doc.to_dict().get("input_budget"),
                "predicted_revenue": doc.to_dict().get("predicted_revenue"),
                "predicted_roi":     doc.to_dict().get("predicted_roi"),
                "risk_level":        doc.to_dict().get("risk_level") or "MODERATE",
                "created_at":        str(doc.to_dict().get("created_at")),
            }
            for doc in docs
        ]
    except Exception:
        return []


# ── Claude AI analysis helper ─────────────────────────────────────────────────
async def _get_claude_analysis(req: PredictRequest, result: dict) -> str:
    prompt = (
        f'Film: "{req.title}" | Budget: ${req.budget:,.0f} | Genre: {req.genre}\n'
        f"Market: {req.market} | Season: {req.season}\n"
        f"Logline: {req.logline}\n"
        f"Prediction: ${result['predicted_revenue']:,.0f} revenue, "
        f"{result['predicted_roi']:.0f}% ROI\n\n"
        "Provide 3 brief bullet points for a Ugandan filmmaker/investor:\n"
        "1. Market opportunity in Uganda\n"
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
