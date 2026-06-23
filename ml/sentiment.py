"""
FilmIQ — Sentiment Analysis Pipeline
Implements the TF-IDF + emotional scoring methodology from Zhang et al. (2024)

F_i = (W_i - 0.5) × Σ(T_ij + 1)
where:
  W_i  = base emotional score (0–1 from classifier)
  T_ij = TF-IDF weight of j-th emotional word in i-th comment
  F_i  = final comment emotion score (negative = negative, positive = positive)

Temporal weighting (30 days pre-release):
  Level I   (20–30 days): weight 0.15
  Level II  (10–20 days): weight 0.20
  Level III ( 5–10 days): weight 0.25
  Level IV  ( 1– 5 days): weight 0.40
"""

import re
import math
from collections import Counter, defaultdict
from typing import List, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger("filmiq.sentiment")

# Try to import NLP libraries; fall back to rule-based
try:
    from textblob import TextBlob
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False

try:
    import nltk
    from nltk.corpus import stopwords
    # word_tokenize requires punkt_tab (NLTK 3.8+) and is not used here.
    # We use str.split() for tokenization to avoid NLTK data version issues.
    HAS_NLTK = True
except ImportError:
    HAS_NLTK = False


# ──────────────────────────────────────────────────────────────────────────────
# Seed emotion dictionaries (abridged from HowNet / NTUSD / THUOCL as in paper)
# ──────────────────────────────────────────────────────────────────────────────
POSITIVE_SEEDS = {
    "amazing", "brilliant", "excellent", "fantastic", "outstanding", "superb",
    "magnificent", "incredible", "wonderful", "masterpiece", "breathtaking",
    "emotional", "touching", "inspiring", "powerful", "beautiful", "perfect",
    "love", "loved", "best", "great", "good", "enjoyed", "recommend", "must-see",
    "captivating", "thrilling", "engaging", "stunning", "authentic", "proud",
    "african", "representation", "diverse", "fresh", "original", "culturally",
}

NEGATIVE_SEEDS = {
    "terrible", "awful", "horrible", "dreadful", "disappointing", "boring",
    "waste", "bad", "worst", "poor", "weak", "slow", "predictable", "cliché",
    "overrated", "forgettable", "bland", "generic", "confusing", "mess",
    "skip", "avoid", "regret", "painful", "tedious", "flat", "dull", "cheap",
}

INTENSIFIERS = {
    "very": 1.5, "extremely": 2.0, "absolutely": 2.0, "totally": 1.5,
    "completely": 1.8, "utterly": 1.8, "incredibly": 1.7, "highly": 1.4,
    "really": 1.3, "quite": 1.2, "so": 1.3, "too": 0.8,
}

NEGATORS = {"not", "no", "never", "n't", "neither", "nor", "hardly", "barely"}


@dataclass
class CommentSentiment:
    text:           str
    base_score:     float     # W_i: 0 to 1 (TextBlob/rule-based)
    tfidf_weight:   float     # T_ij: importance of emotional words
    final_score:    float     # F_i: −0.5 to +0.5
    label:          str       # positive / neutral / negative
    days_before:    Optional[int] = None
    level:          Optional[str] = None     # I, II, III, IV
    level_weight:   Optional[float] = None


class FilmSentimentAnalyzer:
    """
    Sentiment analyzer for film comments.
    Implements the Zhang et al. (2024) scoring methodology.
    """

    LEVEL_WEIGHTS = {
        "IV":  0.40,  # 1–5 days before release
        "III": 0.25,  # 5–10 days
        "II":  0.20,  # 10–20 days
        "I":   0.15,  # 20–30 days
    }

    def __init__(self):
        self.corpus: List[str] = []
        self._idf_cache: dict = {}

    # ── Core scoring ─────────────────────────────────────────────────────────
    def score_comment(self, text: str, days_before: Optional[int] = None) -> CommentSentiment:
        """
        Score a single comment.
        Returns CommentSentiment with F_i = (W_i − 0.5) × Σ(T_ij + 1)
        """
        tokens = self._tokenize(text)

        # Base score W_i ∈ [0, 1]
        base_score = self._base_sentiment(text, tokens)

        # TF-IDF emotional weight T_ij
        tfidf = self._emotional_tfidf(tokens)

        # Paper formula: F_i = (W_i − 0.5) × Σ(T_ij + 1)
        final_score = (base_score - 0.5) * sum(t + 1 for t in tfidf)
        # Clip to a reasonable range
        final_score = max(-0.5, min(0.5, final_score))

        label = "positive" if final_score > 0.05 else ("negative" if final_score < -0.05 else "neutral")

        # Temporal level
        level = None
        level_weight = None
        if days_before is not None:
            level, level_weight = self._get_level(days_before)

        return CommentSentiment(
            text=text,
            base_score=round(base_score, 4),
            tfidf_weight=round(sum(tfidf), 4),
            final_score=round(final_score, 4),
            label=label,
            days_before=days_before,
            level=level,
            level_weight=level_weight,
        )

    def _base_sentiment(self, text: str, tokens: List[str]) -> float:
        """Compute W_i ∈ [0, 1] using TextBlob or rule-based fallback."""
        if HAS_TEXTBLOB:
            polarity = TextBlob(text).sentiment.polarity  # −1 to +1
            return (polarity + 1) / 2                     # map to 0–1

        # Rule-based fallback
        score = 0.0
        count = 0
        negate = False
        for i, tok in enumerate(tokens):
            if tok in NEGATORS:
                negate = True
                continue
            intensifier = INTENSIFIERS.get(tokens[i-1], 1.0) if i > 0 else 1.0
            if tok in POSITIVE_SEEDS:
                val = 0.3 * intensifier
                score += -val if negate else val
                count += 1
                negate = False
            elif tok in NEGATIVE_SEEDS:
                val = -0.3 * intensifier
                score += -val if negate else val
                count += 1
                negate = False
        if count == 0:
            return 0.5  # neutral
        return max(0.0, min(1.0, 0.5 + score / count))

    def _emotional_tfidf(self, tokens: List[str]) -> List[float]:
        """
        Compute TF-IDF weights T_ij for emotional words.
        If corpus is available, use it; else estimate from token frequency.
        """
        emotional_tokens = [t for t in tokens if t in POSITIVE_SEEDS or t in NEGATIVE_SEEDS]
        if not emotional_tokens:
            return [0.0]

        if self._idf_cache and self.corpus:
            weights = []
            tf = Counter(tokens)
            for tok in emotional_tokens:
                tf_val  = tf[tok] / max(len(tokens), 1)
                idf_val = self._idf_cache.get(tok, math.log(1 + len(self.corpus)))
                weights.append(min(tf_val * idf_val, 1.0))
            return weights or [0.1]
        else:
            # Estimate: each emotional word gets weight 0.2
            return [0.2] * len(emotional_tokens)

    def build_corpus_idf(self, texts: List[str]):
        """Build IDF from a corpus of comments."""
        self.corpus = texts
        N = len(texts)
        df: Counter = Counter()
        for text in texts:
            tokens = set(self._tokenize(text))
            for tok in tokens:
                df[tok] += 1
        self._idf_cache = {
            tok: math.log((N + 1) / (freq + 1)) + 1
            for tok, freq in df.items()
        }

    # ── Batch and aggregation ────────────────────────────────────────────────
    def analyze_comments_batch(self, comments: List[dict]) -> dict:
        """
        Analyze a batch of comments with temporal weighting.
        Each comment: {"text": str, "days_before": int}
        Returns aggregate F score for the movie.
        """
        scored = [self.score_comment(c["text"], c.get("days_before")) for c in comments]

        pos = [s for s in scored if s.label == "positive"]
        neu = [s for s in scored if s.label == "neutral"]
        neg = [s for s in scored if s.label == "negative"]

        # Temporal weighted aggregate (paper formula)
        level_scores = defaultdict(list)
        for s in scored:
            if s.level:
                level_scores[s.level].append(s.final_score)

        TV = {
            level: sum(scores) / max(len(scores), 1)
            for level, scores in level_scores.items()
        }
        F_total = sum(
            TV.get(level, 0) * weight
            for level, weight in self.LEVEL_WEIGHTS.items()
        )

        # Fallback if no temporal data
        if not level_scores:
            all_scores = [s.final_score for s in scored]
            F_total = sum(all_scores) / max(len(all_scores), 1) if all_scores else 0

        return {
            "total_comments":    len(scored),
            "positive_count":    len(pos),
            "neutral_count":     len(neu),
            "negative_count":    len(neg),
            "positive_ratio":    round(len(pos) / max(len(scored), 1), 3),
            "neutral_ratio":     round(len(neu) / max(len(scored), 1), 3),
            "negative_ratio":    round(len(neg) / max(len(scored), 1), 3),
            "aggregate_score":   round(F_total, 4),
            "sentiment_label":   "positive" if F_total > 0.05 else ("negative" if F_total < -0.05 else "neutral"),
            "level_scores":      {k: round(v, 4) for k, v in TV.items()},
            "individual_scores": [
                {"text": s.text[:80], "score": s.final_score, "label": s.label}
                for s in scored[:20]
            ],
        }

    # ── Utilities ────────────────────────────────────────────────────────────
    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r"[^\w\s']", " ", text)
        tokens = text.split()
        if HAS_NLTK:
            try:
                stop = set(stopwords.words("english")) - NEGATORS
                tokens = [t for t in tokens if t not in stop]
            except LookupError:
                pass  # corpus not downloaded on this host — fall back to unfiltered tokens
        return tokens

    def _get_level(self, days_before: int) -> tuple:
        if 1 <= days_before <= 5:    return "IV",  0.40
        elif 5 < days_before <= 10:  return "III", 0.25
        elif 10 < days_before <= 20: return "II",  0.20
        elif 20 < days_before <= 30: return "I",   0.15
        return None, None


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI router endpoint helpers
# ──────────────────────────────────────────────────────────────────────────────
analyzer = FilmSentimentAnalyzer()

def analyze_text(text: str, days_before: Optional[int] = None) -> dict:
    result = analyzer.score_comment(text, days_before)
    return {
        "text":        text,
        "base_score":  result.base_score,
        "final_score": result.final_score,
        "label":       result.label,
        "days_before": days_before,
    }

def analyze_batch(comments: List[dict]) -> dict:
    return analyzer.analyze_comments_batch(comments)


# ──────────────────────────────────────────────────────────────────────────────
# Quick test
# ──────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    test_comments = [
        {"text": "Absolutely breathtaking! Best African film I've seen. Must watch!", "days_before": 3},
        {"text": "Really enjoyed this movie, great representation of Ugandan culture", "days_before": 7},
        {"text": "Decent film but the pacing was a bit slow in the second act", "days_before": 12},
        {"text": "Terrible waste of time, very boring and predictable", "days_before": 4},
        {"text": "Amazing cinematography and powerful story. Loved it!", "days_before": 2},
    ]

    result = analyzer.analyze_comments_batch(test_comments)
    print("Batch analysis:")
    for k, v in result.items():
        if k != "individual_scores":
            print(f"  {k}: {v}")
    print("\nPaper formula validation:")
    print(f"  F_total = {result['aggregate_score']:.4f} (positive = >0.05, negative = <-0.05)")
