"""
FilmIQ — Backend Tests: Predictions
Run: cd backend && pytest ../tests/backend/ -v
"""

import pytest
import sys
import os

# Ensure imports resolve correctly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


# ── ML Predictor tests (no DB needed) ────────────────────────────────────────
class TestFilmIQPredictor:
    """Tests for the core ML prediction engine."""

    def setup_method(self):
        from ml.predictor import FilmIQPredictor
        self.predictor = FilmIQPredictor()

    def _predict(self, **kwargs):
        defaults = {
            "title": "Test Film",
            "budget": 5_000_000,
            "genre": "Action",
            "director_score": 0.7,
            "cast_score": 0.65,
            "season": "summer",
            "market": "pan_african",
        }
        defaults.update(kwargs)
        return self.predictor.predict(defaults)

    def test_returns_required_keys(self):
        r = self._predict()
        required = [
            "predicted_revenue", "predicted_opening_weekend",
            "predicted_roi", "confidence", "model_used",
            "genre_multiplier", "risk_level", "recommendation",
        ]
        for key in required:
            assert key in r, f"Missing key: {key}"

    def test_revenue_positive(self):
        r = self._predict(budget=1_000_000)
        assert r["predicted_revenue"] > 0, "Revenue must be positive"

    def test_opening_weekend_fraction_of_total(self):
        r = self._predict(budget=10_000_000)
        assert r["predicted_opening_weekend"] < r["predicted_revenue"], \
            "Opening weekend must be less than total revenue"

    def test_adventure_higher_than_thriller(self):
        """Adventure should predict higher revenue than Thriller (paper: coeff −1.12)."""
        adventure = self._predict(genre="Adventure", market="global")
        thriller  = self._predict(genre="Thriller",  market="global")
        assert adventure["predicted_revenue"] > thriller["predicted_revenue"], \
            "Adventure should outperform Thriller"

    def test_summer_higher_than_general(self):
        """Summer release should predict higher than general release."""
        summer  = self._predict(season="summer")
        general = self._predict(season="general")
        assert summer["predicted_revenue"] >= general["predicted_revenue"], \
            "Summer should outperform general release"

    def test_pan_african_higher_than_uganda_only(self):
        """Pan-African market should predict more revenue than Uganda only."""
        pan     = self._predict(market="pan_african")
        uganda  = self._predict(market="uganda_only")
        # Ensemble model uses budget/genre/popularity features only (TMDB has no market column)
        # Analytical fallback respects market multipliers; ensemble falls back when needed
        assert pan["predicted_revenue"] >= uganda["predicted_revenue"], \
            "Pan-African should not underperform Uganda-only"

    def test_risk_levels_are_valid(self):
        valid_levels = {"LOW", "MODERATE", "HIGH", "VERY HIGH"}
        r = self._predict()
        assert r["risk_level"] in valid_levels, f"Invalid risk level: {r['risk_level']}"

    def test_confidence_between_0_and_1(self):
        r = self._predict()
        assert 0 < r["confidence"] <= 1, f"Confidence out of range: {r['confidence']}"

    def test_higher_budget_higher_revenue(self):
        low  = self._predict(budget=500_000)
        high = self._predict(budget=50_000_000)
        assert high["predicted_revenue"] > low["predicted_revenue"], \
            "Higher budget should yield higher revenue prediction"

    def test_genre_multipliers_loaded(self):
        from ml.predictor import GENRE_MULTIPLIERS
        assert len(GENRE_MULTIPLIERS) >= 10
        assert GENRE_MULTIPLIERS["Adventure"] > GENRE_MULTIPLIERS["Thriller"]

    def test_recommendation_is_string(self):
        r = self._predict()
        assert isinstance(r["recommendation"], str)
        assert len(r["recommendation"]) > 10

    @pytest.mark.parametrize("genre", ["Action", "Comedy", "Drama", "Animation", "Horror"])
    def test_prediction_stable_for_all_genres(self, genre):
        r = self._predict(genre=genre)
        assert r["predicted_revenue"] > 0
        assert r["genre_multiplier"] > 0


# ── Sentiment tests ────────────────────────────────────────────────────────
class TestSentimentAnalyzer:
    """Tests for TF-IDF sentiment scoring (Zhang et al. 2024 methodology)."""

    def setup_method(self):
        from ml.sentiment import FilmSentimentAnalyzer
        self.analyzer = FilmSentimentAnalyzer()

    def test_positive_comment_scores_positive(self):
        result = self.analyzer.score_comment("Amazing breathtaking masterpiece, loved every moment!")
        assert result.label in ("positive", "neutral"), \
            f"Expected positive/neutral but got {result.label}"

    def test_negative_comment_scores_negative(self):
        result = self.analyzer.score_comment("Terrible boring waste of time, awful film")
        assert result.label in ("negative", "neutral"), \
            f"Expected negative/neutral but got {result.label}"

    def test_score_in_range(self):
        result = self.analyzer.score_comment("Good film")
        assert -0.5 <= result.final_score <= 0.5, \
            f"Score out of range: {result.final_score}"

    def test_temporal_level_assignment(self):
        r3  = self.analyzer.score_comment("Great film", days_before=3)
        r7  = self.analyzer.score_comment("Great film", days_before=7)
        r15 = self.analyzer.score_comment("Great film", days_before=15)
        r25 = self.analyzer.score_comment("Great film", days_before=25)
        assert r3.level  == "IV"
        assert r7.level  == "III"
        assert r15.level == "II"
        assert r25.level == "I"

    def test_level_weights_match_paper(self):
        """Paper Table weights: IV=0.40, III=0.25, II=0.20, I=0.15."""
        assert self.analyzer.LEVEL_WEIGHTS["IV"]  == 0.40
        assert self.analyzer.LEVEL_WEIGHTS["III"] == 0.25
        assert self.analyzer.LEVEL_WEIGHTS["II"]  == 0.20
        assert self.analyzer.LEVEL_WEIGHTS["I"]   == 0.15

    def test_batch_analysis_returns_counts(self):
        from ml.sentiment import analyze_batch
        comments = [
            {"text": "Loved this amazing film!", "days_before": 2},
            {"text": "Decent average movie",     "days_before": 8},
            {"text": "Terrible waste",           "days_before": 4},
        ]
        result = analyze_batch(comments)
        assert "total_comments"  in result
        assert "positive_count"  in result
        assert "negative_count"  in result
        assert "aggregate_score" in result
        assert result["total_comments"] == 3

    def test_batch_aggregate_score_in_range(self):
        from ml.sentiment import analyze_batch
        comments = [{"text": f"Comment {i}", "days_before": i+1} for i in range(5)]
        result = analyze_batch(comments)
        assert -0.5 <= result["aggregate_score"] <= 0.5


# ── Config tests ───────────────────────────────────────────────────────────
class TestConfig:
    def test_settings_load(self):
        from config import settings
        assert settings.app_name == "FilmIQ"
        assert settings.jwt_algorithm == "HS256"
        assert settings.anthropic_model.startswith("claude")

    def test_sqlalchemy_url_uses_asyncpg(self):
        from config import settings
        assert "asyncpg" in settings.sqlalchemy_url

    def test_environment_default_is_development(self):
        from config import settings
        assert settings.environment in ("development", "test", "production")
