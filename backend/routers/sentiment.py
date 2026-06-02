"""
FilmIQ — Sentiment Analysis Router
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ml.sentiment import analyze_text, analyze_batch

router = APIRouter()

class SingleComment(BaseModel):
    text:        str
    days_before: Optional[int] = None

class BatchRequest(BaseModel):
    comments: List[SingleComment]
    build_corpus: bool = True

@router.post("/analyze")
async def analyze_single(req: SingleComment):
    return analyze_text(req.text, req.days_before)

@router.post("/batch")
async def analyze_batch_comments(req: BatchRequest):
    comments = [{"text": c.text, "days_before": c.days_before} for c in req.comments]
    return analyze_batch(comments)

@router.get("/demo")
async def sentiment_demo():
    """Demo with sample movie comments."""
    demo_comments = [
        {"text": "Absolutely breathtaking! Best African film I have ever seen. A must-watch masterpiece.", "days_before": 2},
        {"text": "Amazing performance, the story was powerful and emotionally touching.", "days_before": 4},
        {"text": "Good film overall, some parts were slow but the ending was great.", "days_before": 8},
        {"text": "Decent effort but the script felt weak and predictable in places.", "days_before": 14},
        {"text": "Terrible waste of time. Very boring and completely forgettable.", "days_before": 3},
        {"text": "Incredible cinematography of Kampala. Proud to see Uganda represented!", "days_before": 1},
    ]
    return analyze_batch(demo_comments)
