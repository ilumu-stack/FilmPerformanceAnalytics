"""
FilmIQ — Backend Tests: Chat Router Fallback
Run: pytest tests/backend/ -v

The chat fallback used to assert fabricated facts (18% CAGR, invented ROI
percentages for real films) as ground truth. These tests confirm the
fallback is now grounded in analytics_service.py's real, computed numbers.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


class TestChatFallback:
    def test_africa_question_disclaims_missing_data(self):
        from routers.chat import _fallback
        reply = _fallback("What about the African market?")
        assert "no Ugandan-market" in reply

    def test_africa_question_does_not_state_fake_cagr(self):
        from routers.chat import _fallback
        reply = _fallback("What about the African market?")
        assert "18%" not in reply
        assert "CAGR" not in reply or "no" in reply.lower()

    def test_genre_question_uses_real_genre_data(self):
        import analytics_service
        from routers.chat import _fallback
        reply = _fallback("Tell me about genre trends")
        top_genre = analytics_service.top_genres_by_revenue(1)[0]["genre"]
        assert top_genre in reply

    def test_roi_question_uses_real_top_films(self):
        import analytics_service
        from routers.chat import _fallback
        reply = _fallback("What's the best ROI investment?")
        top_film = analytics_service.top_roi_films(1)[0]["title"]
        assert top_film in reply

    def test_model_question_uses_real_accuracy(self):
        import analytics_service
        from routers.chat import _fallback
        reply = _fallback("How accurate is your prediction model?")
        acc = analytics_service.model_accuracy()
        assert str(acc["best_r2"]) in reply

    def test_system_prompt_includes_real_facts_and_disclaimer(self):
        from routers.chat import _system_prompt
        prompt = _system_prompt()
        assert "never invent figures" in prompt
        assert "films in the dataset" in prompt
