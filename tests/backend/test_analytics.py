"""
FilmIQ — Backend Tests: Real Dataset Analytics
Run: pytest tests/backend/ -v

These test the real 4,803-film CSV pipeline (backend/movie_dataset.py) and the
analytics_service.py facade — no seeded/mock data, no SQLAlchemy.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest


class TestMovieDataset:
    """Validate real dataset aggregation in backend/movie_dataset.py."""

    def test_dashboard_stats_has_real_kpis(self):
        import movie_dataset
        stats = movie_dataset.dashboard_stats()
        kpis = stats["kpis"]
        assert kpis["total_films"] > 4000
        assert kpis["films_with_financials"] > 0
        assert kpis["films_with_financials"] <= kpis["total_films"]

    def test_genre_analytics_sorted_by_popularity(self):
        import movie_dataset
        genres = movie_dataset.genre_analytics()
        assert len(genres) > 5
        popularities = [g["avg_popularity"] for g in genres]
        assert popularities == sorted(popularities, reverse=True)

    def test_genre_roi_stats_excludes_small_samples(self):
        import movie_dataset
        stats = movie_dataset.genre_roi_stats(min_films=10)
        for s in stats:
            assert s["film_count"] >= 10

    def test_genre_roi_stats_sorted_descending(self):
        import movie_dataset
        stats = movie_dataset.genre_roi_stats()
        rois = [s["avg_roi_pct"] for s in stats]
        assert rois == sorted(rois, reverse=True)

    def test_top_roi_films_have_real_financials(self):
        import movie_dataset
        films = movie_dataset.top_roi_films(limit=5)
        assert len(films) == 5
        for f in films:
            assert f["budget"] > 0
            assert f["revenue"] > 0
            # roi should match (revenue - budget) / budget * 100 within rounding
            expected = (f["revenue"] - f["budget"]) / f["budget"] * 100
            assert abs(f["roi"] - round(expected, 1)) < 0.5

    def test_top_roi_films_sorted_descending(self):
        import movie_dataset
        films = movie_dataset.top_roi_films(limit=10)
        rois = [f["roi"] for f in films]
        assert rois == sorted(rois, reverse=True)

    def test_genre_cohort_benchmark_real_genre(self):
        import movie_dataset
        bench = movie_dataset.genre_cohort_benchmark("Action", 5_000_000)
        assert bench is not None
        assert bench["genre"] == "Action"
        assert bench["peer_film_count"] > 0
        assert 0 <= bench["budget_percentile"] <= 100

    def test_genre_cohort_benchmark_unknown_genre(self):
        import movie_dataset
        bench = movie_dataset.genre_cohort_benchmark("NotARealGenre", 5_000_000)
        assert bench is None

    def test_trends_has_rating_and_popularity_series(self):
        import movie_dataset
        trends = movie_dataset.trends()
        assert "rating_trend" in trends
        assert "popularity_trend" in trends
        assert len(trends["rating_trend"]) > 10


class TestAnalyticsService:
    """Validate the shared analytics_service.py facade."""

    def test_model_accuracy_has_best_model(self):
        import analytics_service
        acc = analytics_service.model_accuracy()
        assert acc["best_model"] is not None
        assert 0 < acc["best_r2"] <= 100

    def test_model_accuracy_picks_highest_r2(self):
        import analytics_service
        acc = analytics_service.model_accuracy()
        r2s = [m["r2"] for m in acc["models"]]
        assert acc["best_r2"] == max(r2s)

    def test_top_genres_by_revenue_returns_requested_count(self):
        import analytics_service
        genres = analytics_service.top_genres_by_revenue(3)
        assert len(genres) == 3

    def test_top_roi_genres_matches_movie_dataset(self):
        import analytics_service, movie_dataset
        assert analytics_service.top_roi_genres(2) == movie_dataset.genre_roi_stats()[:2]

    def test_chat_context_facts_is_grounded_text(self):
        import analytics_service
        facts = analytics_service.chat_context_facts()
        assert isinstance(facts, str)
        assert "films in the dataset" in facts
        # Must explicitly disclaim the data we don't have, rather than invent it
        assert "Ugandan-market" in facts


class TestPredictorMultipliers:
    """Validate the real predictor constants (used directly by the analytical fallback)."""

    def test_market_multipliers(self):
        from ml.predictor import MARKET_MULTIPLIERS
        assert MARKET_MULTIPLIERS["pan_african"] == 1.0
        assert MARKET_MULTIPLIERS["uganda_only"] < 1.0
        assert MARKET_MULTIPLIERS["global"]      > 1.0

    def test_season_multipliers(self):
        from ml.predictor import SEASON_MULTIPLIERS
        assert SEASON_MULTIPLIERS["summer"]          > SEASON_MULTIPLIERS["general"]
        assert SEASON_MULTIPLIERS["winter_vacation"] > SEASON_MULTIPLIERS["general"]

    def test_mlr_genre_coefficients_from_paper(self):
        from ml.predictor import MLR_GENRE_COEFFICIENTS
        assert MLR_GENRE_COEFFICIENTS["Thriller"] < -1.0
        assert MLR_GENRE_COEFFICIENTS["Comedy"] > 0
        assert MLR_GENRE_COEFFICIENTS["Romance"] > 0
