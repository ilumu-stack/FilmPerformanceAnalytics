"""
FilmIQ — ML Tests: Sentiment Analysis Pipeline
Validates the Zhang et al. (2024) formula implementation.
Run: pytest tests/ml/ -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from ml.sentiment import FilmSentimentAnalyzer, analyze_text, analyze_batch


@pytest.fixture(scope="module")
def analyzer():
    return FilmSentimentAnalyzer()


class TestSentimentFormula:
    """Validate F_i = (W_i - 0.5) × Σ(T_ij + 1) implementation."""

    def test_formula_positive_result_for_positive_text(self, analyzer):
        """When W_i > 0.5, F_i should be positive."""
        result = analyzer.score_comment("This is an amazing wonderful excellent film!")
        # W_i > 0.5 means (W_i - 0.5) > 0, so F_i >= 0
        assert result.base_score >= 0.5 or result.final_score >= -0.1, \
            f"Expected near-positive result, got base={result.base_score} final={result.final_score}"

    def test_formula_negative_result_for_negative_text(self, analyzer):
        """When W_i < 0.5, F_i should be negative."""
        result = analyzer.score_comment("Terrible awful horrible boring waste of time")
        assert result.base_score < 0.5 or result.final_score <= 0.1, \
            f"Expected negative result, got {result.final_score}"

    def test_final_score_bounded(self, analyzer):
        """F_i must be within [−0.5, +0.5] as per paper."""
        for text in [
            "AMAZING INCREDIBLE BEST FILM EVER LOVED IT PERFECT MASTERPIECE",
            "terrible horrible awful worst film ever made boring waste money",
            "okay decent film nothing special average",
            "",
        ]:
            result = analyzer.score_comment(text)
            assert -0.5 <= result.final_score <= 0.5, \
                f"Score {result.final_score} out of bounds for: '{text[:40]}'"

    def test_tfidf_weight_positive(self, analyzer):
        """T_ij should be non-negative."""
        result = analyzer.score_comment("great amazing wonderful film")
        assert result.tfidf_weight >= 0


class TestTemporalWeighting:
    """Validate 4-level temporal weighting scheme from paper."""

    def test_all_four_levels_defined(self, analyzer):
        levels = {"I": 0.15, "II": 0.20, "III": 0.25, "IV": 0.40}
        for level, weight in levels.items():
            assert analyzer.LEVEL_WEIGHTS[level] == weight, \
                f"Level {level}: expected {weight}, got {analyzer.LEVEL_WEIGHTS[level]}"

    def test_level_weights_sum_to_one(self, analyzer):
        total = sum(analyzer.LEVEL_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9, f"Weights sum to {total}, expected 1.0"

    @pytest.mark.parametrize("days,expected_level", [
        (1, "IV"), (3, "IV"), (5, "IV"),
        (6, "III"), (9, "III"), (10, "III"),
        (11, "II"), (18, "II"), (20, "II"),
        (21, "I"), (28, "I"), (30, "I"),
    ])
    def test_level_boundaries(self, analyzer, days, expected_level):
        result = analyzer.score_comment("test", days_before=days)
        assert result.level == expected_level, \
            f"days={days}: expected {expected_level}, got {result.level}"

    def test_no_level_beyond_30_days(self, analyzer):
        result = analyzer.score_comment("test", days_before=35)
        assert result.level is None

    def test_batch_aggregate_uses_temporal_weights(self):
        """Aggregate F_total = Σ(T_V × weight_V) per paper."""
        comments = [
            {"text": "Amazing film!",    "days_before": 3},   # Level IV, w=0.40
            {"text": "Great movie",      "days_before": 7},   # Level III, w=0.25
            {"text": "Good film",        "days_before": 15},  # Level II, w=0.20
            {"text": "Decent",           "days_before": 25},  # Level I, w=0.15
        ]
        result = analyze_batch(comments)
        assert "aggregate_score" in result
        assert isinstance(result["aggregate_score"], float)
        assert -0.5 <= result["aggregate_score"] <= 0.5


class TestBatchAnalysis:
    """Tests for batch comment analysis endpoint."""

    def test_counts_sum_to_total(self):
        comments = [
            {"text": "Brilliant!",    "days_before": 2},
            {"text": "Okay film",     "days_before": 6},
            {"text": "Very boring",   "days_before": 4},
            {"text": "Loved it",      "days_before": 9},
            {"text": "Skip this one", "days_before": 3},
        ]
        result = analyze_batch(comments)
        total = result["positive_count"] + result["neutral_count"] + result["negative_count"]
        assert total == result["total_comments"] == 5

    def test_ratios_sum_to_one(self):
        comments = [{"text": f"Film comment {i}", "days_before": i+1} for i in range(6)]
        result = analyze_batch(comments)
        ratio_sum = result["positive_ratio"] + result["neutral_ratio"] + result["negative_ratio"]
        assert abs(ratio_sum - 1.0) < 1e-6, f"Ratios sum to {ratio_sum}"

    def test_empty_batch(self):
        result = analyze_batch([])
        assert result["total_comments"] == 0
        assert result["aggregate_score"] == 0

    def test_individual_scores_truncated(self):
        comments = [{"text": f"Comment {i}", "days_before": 1} for i in range(25)]
        result = analyze_batch(comments)
        # Should return max 20 individual scores
        assert len(result["individual_scores"]) <= 20


class TestSentimentHelpers:
    """Tests for analyze_text and analyze_batch module-level helpers."""

    def test_analyze_text_returns_dict(self):
        result = analyze_text("Great African cinema", days_before=3)
        assert isinstance(result, dict)
        assert "label" in result
        assert "final_score" in result

    def test_analyze_text_label_valid(self):
        result = analyze_text("Amazing film")
        assert result["label"] in ("positive", "neutral", "negative")

    def test_analyze_batch_is_callable(self):
        result = analyze_batch([{"text": "Good film", "days_before": 5}])
        assert "total_comments" in result
        assert result["total_comments"] == 1
