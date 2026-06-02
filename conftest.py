"""
FilmIQ — Pytest Configuration & Shared Fixtures
"""
import sys
import os
import pytest

# Add backend and root to sys.path so all imports resolve
ROOT    = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
for p in [ROOT, BACKEND]:
    if p not in sys.path:
        sys.path.insert(0, p)


@pytest.fixture(scope="session")
def predictor():
    from ml.predictor import FilmIQPredictor
    return FilmIQPredictor()


@pytest.fixture(scope="session")
def analyzer():
    from ml.sentiment import FilmSentimentAnalyzer
    return FilmSentimentAnalyzer()


@pytest.fixture
def sample_predict_input():
    return {
        "title":          "Kampala Nights",
        "budget":         5_000_000,
        "genre":          "Action",
        "director_score": 0.7,
        "cast_score":     0.65,
        "season":         "summer",
        "market":         "pan_african",
        "logline":        "A cyberpunk thriller set in 2040 Kampala",
    }


@pytest.fixture
def sample_comments():
    return [
        {"text": "Absolutely breathtaking! Best African film I've seen.",  "days_before": 2},
        {"text": "Really enjoyed this, great Ugandan culture representation.", "days_before": 4},
        {"text": "Decent film but the pacing was slow in places.",           "days_before": 8},
        {"text": "Terrible waste of time, very boring and predictable.",     "days_before": 3},
        {"text": "Amazing cinematography of Kampala. Proud representation!", "days_before": 1},
    ]
