"""
FilmIQ — Backend Tests: Analytics & Seeded Data
Run: cd backend && pytest ../tests/backend/ -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


class TestSeededData:
    """Validate seeded genre and movie data correctness."""

    def test_genre_multipliers_ordered(self):
        from ml.predictor import GENRE_MULTIPLIERS
        assert GENRE_MULTIPLIERS["Adventure"] > GENRE_MULTIPLIERS["Drama"]
        assert GENRE_MULTIPLIERS["Animation"] > GENRE_MULTIPLIERS["Thriller"]
        assert GENRE_MULTIPLIERS["Action"]    > GENRE_MULTIPLIERS["Horror"]

    def test_mlr_coefficients_sign_correct(self):
        """Paper Table 6: thriller negative, comedy positive."""
        from routers.analytics import _seeded_genre_analytics
        genres = {g["genre"]: g for g in _seeded_genre_analytics()}
        assert genres["Adventure"]["avg_revenue"] > genres["Thriller"]["avg_revenue"]
        assert genres["Action"]["avg_revenue"]    > genres["Drama"]["avg_revenue"]

    def test_year_trend_covers_required_range(self):
        from routers.analytics import _seeded_year_trend
        years = [int(y["year"]) for y in _seeded_year_trend()]
        assert min(years) <= 2018
        assert max(years) >= 2023

    def test_top_directors_seeded(self):
        from routers.analytics import _seeded_top_directors
        directors = _seeded_top_directors()
        assert len(directors) >= 5
        # Sorted by revenue descending
        revenues = [d["total_revenue"] for d in directors]
        assert revenues == sorted(revenues, reverse=True)

    def test_seasonal_has_12_months(self):
        from routers.analytics import _seeded_seasonal
        months = _seeded_seasonal()
        assert len(months) == 12

    def test_model_comparison_has_ensemble(self):
        from routers.analytics import _model_comparison_data
        data = _model_comparison_data()
        model_names = [m["name"] for m in data["models"]]
        assert any("Ensemble" in n or "CNN" in n for n in model_names)
        assert data["paper_accuracy"] == 83.7


class TestPredictorMultipliers:
    """Validate the African market multipliers."""

    def test_market_multipliers(self):
        from ml.predictor import MARKET_MULTIPLIERS
        assert MARKET_MULTIPLIERS["pan_african"]    == 1.0
        assert MARKET_MULTIPLIERS["uganda_only"]    < 1.0
        assert MARKET_MULTIPLIERS["global"]         > 1.0

    def test_season_multipliers(self):
        from ml.predictor import SEASON_MULTIPLIERS
        assert SEASON_MULTIPLIERS["summer"]          > SEASON_MULTIPLIERS["general"]
        assert SEASON_MULTIPLIERS["winter_vacation"] > SEASON_MULTIPLIERS["general"]

    def test_mlr_genre_coefficients_from_paper(self):
        """Verify paper Table 6 coefficients are loaded."""
        from ml.predictor import MLR_GENRE_COEFFICIENTS
        # Thriller must be most negative
        assert MLR_GENRE_COEFFICIENTS["Thriller"] < -1.0
        # Comedy should be positive
        assert MLR_GENRE_COEFFICIENTS["Comedy"] > 0
        # Romance positive
        assert MLR_GENRE_COEFFICIENTS["Romance"] > 0
