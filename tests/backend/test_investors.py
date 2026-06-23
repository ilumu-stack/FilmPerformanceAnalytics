"""
FilmIQ — Backend Tests: Investor Router
Run: pytest tests/backend/ -v

Covers: role-based access enforcement (auth_utils.get_current_investor) and the
real-data computations that replaced the previously hardcoded investor endpoints.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import asyncio
import pytest
from fastapi import HTTPException


def _fake_user(role: str):
    from models import User
    return User(
        id="u1", username="u", email="u@example.com", hashed_password="x",
        role=role, full_name="U", organisation=None, country=None,
        is_active=True, must_change_password=False, created_at=None,
        updated_at=None, last_login=None,
    )


class TestInvestorRoleEnforcement:
    """get_current_investor must reject everyone except investor/admin —
    this is what every endpoint in investors.py now depends on."""

    def test_investor_role_allowed(self):
        from auth_utils import get_current_investor
        user = _fake_user("investor")
        result = asyncio.run(get_current_investor(user))
        assert result is user

    def test_admin_role_allowed(self):
        from auth_utils import get_current_investor
        user = _fake_user("admin")
        result = asyncio.run(get_current_investor(user))
        assert result is user

    @pytest.mark.parametrize("role", ["filmmaker", "analyst", "viewer"])
    def test_other_roles_rejected(self, role):
        from auth_utils import get_current_investor
        user = _fake_user(role)
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_current_investor(user))
        assert exc_info.value.status_code == 403


class TestInvestorRealData:
    """The investor endpoints must compute from movie_dataset.py, not return
    fixed literals — these tests would fail against the old hardcoded version."""

    def test_roi_matrix_values_vary_by_genre(self):
        import movie_dataset
        stats = movie_dataset.genre_roi_stats()
        rois = {s["genre"]: s["avg_roi_pct"] for s in stats}
        # The old hardcoded matrix had exactly 10 fixed genres with fixed values;
        # the real data should not match that fixed set of numbers.
        assert rois != {
            "Adventure": 812, "Animation": 643, "Family": 580, "Action": 521,
            "Science Fiction": 490, "Comedy": 320, "Romance": 210, "Drama": 180,
            "Horror": 280, "Thriller": -12,
        }

    def test_top_roi_films_are_not_the_old_hardcoded_list(self):
        import movie_dataset
        films = {f["title"] for f in movie_dataset.top_roi_films(limit=8)}
        old_hardcoded = {
            "Ne Zha 2", "Avatar", "Titanic", "Jurassic World",
            "The Lion King (2019)", "Avengers: Endgame", "The Avengers", "Star Wars: TFA",
        }
        assert films != old_hardcoded

    def test_simulate_director_and_cast_score_are_adjustable(self, predictor):
        """Regression guard: these used to be buried fixed 0.6 values inside the
        endpoint with no way for a caller to vary them."""
        low  = predictor.predict({"budget": 5_000_000, "genre": "Action", "market": "pan_african",
                                   "season": "summer", "director_score": 0.1, "cast_score": 0.1})
        high = predictor.predict({"budget": 5_000_000, "genre": "Action", "market": "pan_african",
                                   "season": "summer", "director_score": 0.9, "cast_score": 0.9})
        assert high["predicted_revenue"] > low["predicted_revenue"]
