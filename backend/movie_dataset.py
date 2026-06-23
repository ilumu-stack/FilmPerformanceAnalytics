"""
FilmIQ — Movie Dataset (real data, no external paid APIs)
Loads `data/movie_dataset.csv` (4,803 real TMDb movies — the classic TMDB-5000
metadata set) once into a process-wide cached pandas DataFrame and exposes
query/aggregation helpers consumed by routers/movies.py and routers/analytics.py.

The CSV's `id` column is the real TMDb movie id, so it doubles as `tmdb_id`
for the free TMDb image-enrichment pipeline (tmdb_service.py) — no separate
id mapping needed.

Columns available: index, budget, genres, homepage, id, keywords,
original_language, original_title, overview, popularity, production_companies,
production_countries, release_date, revenue, runtime, spoken_languages, status,
tagline, title, vote_average, vote_count, cast, crew, director.

Data-quality notes (real, not introduced by us):
- `genres`, `cast`, and `keywords` are pre-flattened to whitespace-joined text
  (no delimiter), not JSON lists like `production_companies`/`production_countries`.
  `genres` is safely recoverable: its 22 raw tokens are exactly the 20 official
  TMDb genre names with "Science Fiction" and "TV Movie" split on the space —
  `_parse_genres` rejoins those two pairs deterministically.
- `cast` has no recoverable word-boundary information for multi-word actor
  names; `_parse_cast` pairs consecutive tokens two at a time (the dominant
  "First Last" pattern). This will misparse single-token stage names (e.g.
  "Rihanna") and 3+ word names — a real limitation of the source column, not
  fabricated data.
- `keywords` is left as a flat bag of single words (multi-word phrases like
  "space war" cannot be reconstructed) — used only for rough text overlap,
  never displayed as discrete keyword phrases.
"""

import ast
import json
import re
from pathlib import Path
from typing import Any, Optional

import pandas as pd

_UNICODE_ESCAPE_RE = re.compile(r"\\u([0-9a-fA-F]{4})")

# Local dev: data/ lives at filmiq/data/, one level above backend/.
# Docker: the backend image's WORKDIR is /app with backend/'s own contents
# copied directly into it, and docker-compose mounts ./data at /app/data —
# i.e. data/ is a *sibling* of this file there, not one level up.
_CSV_CANDIDATES = [
    Path(__file__).parent / "data" / "movie_dataset.csv",         # Docker layout
    Path(__file__).parent.parent / "data" / "movie_dataset.csv",  # local dev layout
]
CSV_PATH = next((p for p in _CSV_CANDIDATES if p.exists()), _CSV_CANDIDATES[0])

MIN_VOTES_FOR_RATING = 20  # floor applied to "highest rated" rankings to avoid single-vote outliers

# Some rows have budget/revenue placeholder values like $1 or $10 (e.g. "Modern
# Times" budget=1, revenue=8.5M → 850,000,000% ROI) — clear data-entry errors,
# not real micro-budgets. Excluded from ROI/financial aggregates so a handful
# of bad rows don't dominate genre/film averages.
MIN_BUDGET_FOR_FINANCIALS = 1_000

# The only two TMDb genre names that contain a space — recovered deterministically
# from the whitespace-flattened `genres` column (see module docstring).
_GENRE_MERGE_PAIRS = {("Science", "Fiction"): "Science Fiction", ("TV", "Movie"): "TV Movie"}

_df: Optional[pd.DataFrame] = None


def _unescape(s: str) -> str:
    """The CSV stores literal `\\uXXXX` escape sequences as plain text (not real
    UTF-8 bytes) in genres/cast/keywords/overview/etc. Replace just those
    sequences with the characters they represent — the rest of the string is
    already correctly-decoded UTF-8 text and must be left alone."""
    return _UNICODE_ESCAPE_RE.sub(lambda m: chr(int(m.group(1), 16)), s)


def _parse_genres(value: Any) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        return []
    tokens = _unescape(value).split()
    out: list[str] = []
    i = 0
    while i < len(tokens):
        pair = (tokens[i], tokens[i + 1]) if i + 1 < len(tokens) else None
        if pair in _GENRE_MERGE_PAIRS:
            out.append(_GENRE_MERGE_PAIRS[pair])
            i += 2
        else:
            out.append(tokens[i])
            i += 1
    return out


def _parse_cast(value: Any) -> list[str]:
    """Pair consecutive tokens as "First Last" — see module docstring limitation."""
    if not isinstance(value, str) or not value.strip():
        return []
    tokens = _unescape(value).split()
    names = [" ".join(tokens[i:i + 2]) for i in range(0, len(tokens), 2)]
    return names


def _parse_keywords(value: Any) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        return []
    return _unescape(value).split()


def _parse_names_json(value: Any) -> list[str]:
    """Parse `production_companies` / `production_countries` JSON-array-of-dicts."""
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        parsed = json.loads(_unescape(value))
    except (ValueError, TypeError):
        try:
            parsed = ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return []
    if isinstance(parsed, list):
        return [str(d.get("name", "")).strip() for d in parsed if isinstance(d, dict) and d.get("name")]
    return []


def _load() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH, encoding="utf-8")

    df["genres"] = df["genres"].apply(_parse_genres)
    df["cast"] = df["cast"].apply(_parse_cast)
    df["keywords"] = df["keywords"].apply(_parse_keywords)
    df["production_companies"] = df["production_companies"].apply(_parse_names_json)
    df["production_countries"] = df["production_countries"].apply(_parse_names_json)

    for col in ("title", "original_title", "overview", "tagline", "director", "homepage", "status"):
        df[col] = df[col].fillna("").astype(str).apply(_unescape)

    df["original_language"] = df["original_language"].fillna("").astype(str)
    df["release_date"] = df["release_date"].fillna("").astype(str)

    for col in ("budget", "revenue", "runtime", "vote_average", "vote_count", "popularity"):
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["year"] = pd.to_datetime(df["release_date"], errors="coerce").dt.year
    df["decade"] = (df["year"] // 10 * 10).astype("Int64")

    df = df.drop_duplicates(subset="id", keep="first").reset_index(drop=True)

    has_financials = (df["budget"] > MIN_BUDGET_FOR_FINANCIALS) & (df["revenue"] > 0)
    df["has_financials"] = has_financials
    df["roi"] = None
    df.loc[has_financials, "roi"] = (
        (df.loc[has_financials, "revenue"] - df.loc[has_financials, "budget"])
        / df.loc[has_financials, "budget"] * 100
    )

    return df


def get_df() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = _load()
    return _df


def _clean(value: Any) -> Any:
    """Convert numpy/pandas scalars to plain JSON-safe Python values."""
    if isinstance(value, (list, dict)):
        return value
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def _row_to_movie(row: pd.Series) -> dict[str, Any]:
    return {
        "id":                  int(row["id"]),
        "tmdb_id":             int(row["id"]),
        "title":               row["title"],
        "budget":              float(row["budget"]),
        "revenue":             float(row["revenue"]),
        "roi":                 _clean(row["roi"]),
        "vote_average":        float(row["vote_average"]),
        "vote_count":          int(row["vote_count"]),
        "popularity":          float(row["popularity"]),
        "release_date":        row["release_date"] or None,
        "year":                _clean(row["year"]),
        "runtime":             int(row["runtime"]) if row["runtime"] else None,
        "genres":              row["genres"],
        "cast":                row["cast"],
        "director":            row["director"] or None,
        "production_companies": row["production_companies"],
        "production_countries": row["production_countries"],
        "original_language":   row["original_language"] or None,
        "overview":            row["overview"] or None,
        "tagline":             row["tagline"] or None,
        "keywords":            row["keywords"],
        "status":              row["status"] or None,
    }


# ─── Single movie / lookups ───────────────────────────────────────────────────
def get_movie(movie_id: int) -> Optional[dict[str, Any]]:
    df = get_df()
    match = df[df["id"] == movie_id]
    if match.empty:
        return None
    return _row_to_movie(match.iloc[0])


def get_many_by_ids(ids: list[int]) -> list[dict[str, Any]]:
    df = get_df()
    match = df[df["id"].isin(ids)]
    by_id = {int(row["id"]): _row_to_movie(row) for _, row in match.iterrows()}
    return [by_id[i] for i in ids if i in by_id]


# ─── List / filter / search ───────────────────────────────────────────────────
def list_movies(
    page: int = 1,
    limit: int = 20,
    genre: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    min_popularity: Optional[float] = None,
    max_popularity: Optional[float] = None,
    min_runtime: Optional[int] = None,
    max_runtime: Optional[int] = None,
    sort: str = "revenue",
) -> tuple[list[dict[str, Any]], int]:
    df = get_df()
    mask = pd.Series(True, index=df.index)

    if genre:
        g = genre.lower()
        mask &= df["genres"].apply(lambda gs: any(g in x.lower() for x in gs))
    if year_from is not None:
        mask &= df["year"] >= year_from
    if year_to is not None:
        mask &= df["year"] <= year_to
    if min_rating is not None:
        mask &= df["vote_average"] >= min_rating
    if max_rating is not None:
        mask &= df["vote_average"] <= max_rating
    if min_popularity is not None:
        mask &= df["popularity"] >= min_popularity
    if max_popularity is not None:
        mask &= df["popularity"] <= max_popularity
    if min_runtime is not None:
        mask &= df["runtime"] >= min_runtime
    if max_runtime is not None:
        mask &= df["runtime"] <= max_runtime

    filtered = df[mask]
    total = len(filtered)

    sort_col = {
        "revenue": "revenue", "budget": "budget", "roi": "roi",
        "vote_average": "vote_average", "popularity": "popularity",
    }.get(sort, "revenue")
    filtered = filtered.sort_values(sort_col, ascending=False, na_position="last")

    offset = (page - 1) * limit
    page_rows = filtered.iloc[offset: offset + limit]
    return [_row_to_movie(row) for _, row in page_rows.iterrows()], total


def search_movies(q: str, limit: int = 10) -> list[dict[str, Any]]:
    df = get_df()
    needle = q.lower()
    match = df[df["title"].str.lower().str.contains(needle, na=False, regex=False)]
    match = match.sort_values("popularity", ascending=False)
    return [_row_to_movie(row) for _, row in match.head(limit).iterrows()]


def top_movies(limit: int = 10, genre: Optional[str] = None) -> list[dict[str, Any]]:
    rows, _ = list_movies(page=1, limit=limit, genre=genre, sort="revenue")
    return rows


def featured_movies(limit: int = 5) -> list[dict[str, Any]]:
    df = get_df()
    top = df[df["has_financials"]].sort_values("revenue", ascending=False).head(limit)
    return [_row_to_movie(row) for _, row in top.iterrows()]


# ─── Similar movies / recommendations (Feature 4) ─────────────────────────────
# Weighted multi-signal similarity over real dataset fields: genre + cast +
# director overlap (original signals) plus keyword and production-company
# overlap and vote_average closeness (now available from movie_dataset.csv).
# Weights sum to 1.0 — "similarity_score" doubles as a recommendation
# confidence score in [0, 1].
_SIMILARITY_WEIGHTS = {
    "genre": 0.30, "cast": 0.20, "director": 0.10,
    "keyword": 0.15, "production_company": 0.05,
    "popularity": 0.10, "rating": 0.10,
}


def similar_movies(movie_id: int, limit: int = 10) -> list[dict[str, Any]]:
    df = get_df()
    target_rows = df[df["id"] == movie_id]
    if target_rows.empty:
        return []
    target = target_rows.iloc[0]
    target_genres = set(target["genres"])
    target_cast = set(target["cast"])
    target_keywords = set(target["keywords"])
    target_companies = set(target["production_companies"])
    target_director = target["director"]
    target_pop = target["popularity"]
    target_rating = target["vote_average"]

    candidates = df[df["id"] != movie_id].copy()

    def jaccard(a: set, b: set) -> float:
        if not a and not b:
            return 0.0
        union = a | b
        return len(a & b) / len(union) if union else 0.0

    def score_row(row) -> float:
        w = _SIMILARITY_WEIGHTS
        genre_score   = jaccard(target_genres, set(row["genres"]))
        cast_score    = jaccard(target_cast, set(row["cast"]))
        keyword_score = jaccard(target_keywords, set(row["keywords"]))
        company_score = jaccard(target_companies, set(row["production_companies"]))
        director_score = 1.0 if target_director and row["director"] == target_director else 0.0
        pop_score    = 1.0 / (1.0 + abs(target_pop - row["popularity"]) / 50.0)
        rating_score = 1.0 / (1.0 + abs(target_rating - row["vote_average"]) / 2.0)
        return (
            w["genre"] * genre_score + w["cast"] * cast_score + w["director"] * director_score
            + w["keyword"] * keyword_score + w["production_company"] * company_score
            + w["popularity"] * pop_score + w["rating"] * rating_score
        )

    candidates["similarity"] = candidates.apply(score_row, axis=1)
    candidates = candidates[candidates["similarity"] > 0]
    top = candidates.sort_values("similarity", ascending=False).head(limit)

    results = []
    for _, row in top.iterrows():
        movie = _row_to_movie(row)
        movie["similarity_score"] = round(float(row["similarity"]), 4)
        results.append(movie)
    return results


# ─── Per-movie trend metrics (Feature 8) ───────────────────────────────────────
def trend_metrics(movie_id: int) -> Optional[dict[str, Any]]:
    """How this movie ranks against its genre peers and its release-year peers."""
    df = get_df()
    target_rows = df[df["id"] == movie_id]
    if target_rows.empty:
        return None
    target = target_rows.iloc[0]

    def percentile(series: pd.Series, value: float) -> float:
        if series.empty:
            return 0.0
        return round((series < value).mean() * 100, 1)

    genre_peers = df[df["genres"].apply(lambda gs: bool(set(gs) & set(target["genres"])))]
    year_peers = df[df["year"] == target["year"]] if pd.notna(target["year"]) else df.iloc[0:0]

    result: dict[str, Any] = {
        "genre_peer_count": int(len(genre_peers)),
        "rating_percentile_in_genre": percentile(genre_peers["vote_average"], target["vote_average"]),
        "popularity_percentile_in_genre": percentile(genre_peers["popularity"], target["popularity"]),
    }
    if target["has_financials"]:
        genre_financial = genre_peers[genre_peers["has_financials"]]
        result["revenue_percentile_in_genre"] = percentile(genre_financial["revenue"], target["revenue"])
    if not year_peers.empty:
        result["year_peer_count"] = int(len(year_peers))
        result["popularity_percentile_in_year"] = percentile(year_peers["popularity"], target["popularity"])
    return result


# ─── Genre analytics (Feature 2) ───────────────────────────────────────────────
def genre_analytics() -> list[dict[str, Any]]:
    df = get_df()
    exploded = df.explode("genres")
    exploded = exploded[exploded["genres"].notna() & (exploded["genres"] != "")]

    rows = []
    for genre, group in exploded.groupby("genres"):
        financial = group[group["has_financials"]]
        top_movie = None
        if not financial.empty:
            top_row = financial.sort_values("revenue", ascending=False).iloc[0]
        elif not group.empty:
            top_row = group.sort_values("popularity", ascending=False).iloc[0]
        else:
            top_row = None
        if top_row is not None:
            top_movie = {"id": int(top_row["id"]), "title": top_row["title"], "revenue": float(top_row["revenue"])}

        by_year = group.dropna(subset=["year"]).groupby("year").size()
        growth = [{"year": int(y), "count": int(c)} for y, c in sorted(by_year.items())]

        rows.append({
            "genre":        genre,
            "count":        int(len(group)),
            "avg_rating":   round(float(group["vote_average"].mean()), 2),
            "avg_popularity": round(float(group["popularity"].mean()), 1),
            "avg_revenue":  round(float(financial["revenue"].mean()), 0) if not financial.empty else 0,
            "top_movie":    top_movie,
            "growth":       growth,
        })

    return sorted(rows, key=lambda r: r["avg_popularity"], reverse=True)


# ─── Trend explorer (Feature 5) ────────────────────────────────────────────────
def trends() -> dict[str, Any]:
    df = get_df()
    valid_year = df.dropna(subset=["year"])

    rating_by_year = valid_year.groupby("year")["vote_average"].mean().round(2)
    popularity_by_year = valid_year.groupby("year")["popularity"].mean().round(1)
    count_by_year = valid_year.groupby("year").size()

    rating_trend = [{"year": int(y), "avg_rating": float(v)} for y, v in rating_by_year.items()]
    popularity_trend = [{"year": int(y), "avg_popularity": float(v)} for y, v in popularity_by_year.items()]
    production_growth = [{"year": int(y), "count": int(v)} for y, v in count_by_year.items()]

    # Genre popularity by decade — top 6 genres overall, avg popularity per decade
    exploded = valid_year.explode("genres")
    exploded = exploded[exploded["genres"].notna() & (exploded["genres"] != "")]
    top_genres = exploded["genres"].value_counts().head(6).index.tolist()
    by_decade = exploded[exploded["genres"].isin(top_genres)].dropna(subset=["decade"])
    decade_pivot = by_decade.groupby(["decade", "genres"])["popularity"].mean().round(1)
    genre_by_decade: dict[str, dict[str, float]] = {}
    for (decade, genre), value in decade_pivot.items():
        key = f"{int(decade)}s"
        genre_by_decade.setdefault(key, {})[genre] = float(value)

    return {
        "rating_trend":       rating_trend,
        "popularity_trend":   popularity_trend,
        "production_growth":  production_growth,
        "genre_by_decade":    genre_by_decade,
        "top_genres":         top_genres,
    }


# ─── Seasonal / language (real groupbys, replacing fake constants) ────────────
def seasonal_performance() -> list[dict[str, Any]]:
    df = get_df()
    valid = df[df["has_financials"]].dropna(subset=["year"]).copy()
    valid["month"] = pd.to_datetime(valid["release_date"], errors="coerce").dt.month
    valid = valid.dropna(subset=["month"])
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    grouped = valid.groupby("month")["revenue"].agg(["mean", "count"])
    return [
        {"month": months[int(m) - 1], "avg_revenue": round(row["mean"] / 1e6, 1), "count": int(row["count"])}
        for m, row in grouped.iterrows()
    ]


def language_distribution() -> list[dict[str, Any]]:
    df = get_df()
    valid = df[df["original_language"] != ""]
    grouped = valid.groupby("original_language").agg(count=("id", "size"), total=("revenue", "sum"))
    grouped = grouped.sort_values("count", ascending=False)
    return [
        {"language": lang, "count": int(row["count"]), "total": round(float(row["total"]) / 1e6, 1)}
        for lang, row in grouped.iterrows()
    ]


def country_distribution() -> list[dict[str, Any]]:
    """Production-country breakdown — uses `production_countries`, now real
    (TMDB JSON-array field) rather than absent under the previous dataset."""
    df = get_df()
    exploded = df.explode("production_countries")
    exploded = exploded[exploded["production_countries"].notna() & (exploded["production_countries"] != "")]
    grouped = exploded.groupby("production_countries").agg(
        count=("id", "size"),
        avg_rating=("vote_average", "mean"),
        total_revenue=("revenue", "sum"),
    )
    grouped = grouped.sort_values("count", ascending=False)
    return [
        {
            "country":       country,
            "count":         int(row["count"]),
            "avg_rating":    round(float(row["avg_rating"]), 2),
            "total_revenue_musd": round(float(row["total_revenue"]) / 1e6, 1),
        }
        for country, row in grouped.iterrows()
    ]


def budget_revenue_scatter(genre: Optional[str] = None, limit: int = 200) -> list[dict[str, Any]]:
    df = get_df()
    subset = df[df["has_financials"]]
    if genre:
        g = genre.lower()
        subset = subset[subset["genres"].apply(lambda gs: any(g in x.lower() for x in gs))]
    subset = subset.sort_values("popularity", ascending=False).head(limit)
    return [
        {
            "title":   row["title"],
            "budget":  round(float(row["budget"]) / 1e6, 1),
            "revenue": round(float(row["revenue"]) / 1e6, 1),
            "rating":  float(row["vote_average"]),
        }
        for _, row in subset.iterrows()
    ]


# ─── People analytics (Feature 6) ──────────────────────────────────────────────
def people_analytics(limit: int = 20) -> dict[str, Any]:
    df = get_df()

    directors_df = df[df["director"] != ""]
    director_rows = []
    for name, group in directors_df.groupby("director"):
        financial = group[group["has_financials"]]
        genre_counts: dict[str, int] = {}
        for genres in group["genres"]:
            for g in genres:
                genre_counts[g] = genre_counts.get(g, 0) + 1
        top_genre = max(genre_counts, key=genre_counts.get) if genre_counts else None
        director_rows.append({
            "name":           name,
            "film_count":     int(len(group)),
            "avg_rating":     round(float(group["vote_average"].mean()), 2),
            "total_revenue":  float(financial["revenue"].sum()) if not financial.empty else 0,
            "top_genre":      top_genre,
        })
    director_rows.sort(key=lambda r: r["total_revenue"], reverse=True)

    exploded_cast = df[["id", "vote_average", "genres"]].copy()
    exploded_cast["cast"] = df["cast"]
    exploded_cast = exploded_cast.explode("cast")
    exploded_cast = exploded_cast[exploded_cast["cast"].notna() & (exploded_cast["cast"] != "")]

    actor_rows = []
    for name, group in exploded_cast.groupby("cast"):
        if len(group) < 2:
            continue
        genre_counts: dict[str, int] = {}
        for genres in group["genres"]:
            for g in genres:
                genre_counts[g] = genre_counts.get(g, 0) + 1
        top_genre = max(genre_counts, key=genre_counts.get) if genre_counts else None
        actor_rows.append({
            "name":        name,
            "film_count":  int(len(group)),
            "avg_rating":  round(float(group["vote_average"].mean()), 2),
            "top_genre":   top_genre,
        })
    actor_rows.sort(key=lambda r: r["film_count"], reverse=True)

    return {
        "top_directors": director_rows[:limit],
        "top_actors":    actor_rows[:limit],
    }


# ─── Investor analytics (genre ROI/risk, top-ROI films) ────────────────────────
def genre_roi_stats(min_films: int = 10) -> list[dict[str, Any]]:
    """Real ROI and loss-rate per genre, computed from films with both budget and revenue.

    `loss_rate_pct` (the share of a genre's films with negative ROI) stands in for
    "risk" — there is no separate risk-rating field in the source data.
    """
    df = get_df()
    financial = df[df["has_financials"]]
    exploded = financial.explode("genres")
    exploded = exploded[exploded["genres"].notna() & (exploded["genres"] != "")]

    rows = []
    for genre, group in exploded.groupby("genres"):
        if len(group) < min_films:
            continue
        rows.append({
            "genre":            genre,
            "film_count":       int(len(group)),
            "avg_roi_pct":      round(float(group["roi"].mean()), 1),
            "avg_budget_musd":  round(float(group["budget"].mean()) / 1e6, 1),
            "avg_revenue_musd": round(float(group["revenue"].mean()) / 1e6, 1),
            "loss_rate_pct":    round(float((group["roi"] < 0).mean() * 100), 1),
        })
    return sorted(rows, key=lambda r: r["avg_roi_pct"], reverse=True)


def top_roi_films(limit: int = 10) -> list[dict[str, Any]]:
    df = get_df()
    financial = df[df["has_financials"]]
    top = financial.sort_values("roi", ascending=False).head(limit)
    return [
        {
            "id":      int(r["id"]),
            "title":   r["title"],
            "budget":  float(r["budget"]),
            "revenue": float(r["revenue"]),
            "roi":     round(float(r["roi"]), 1),
        }
        for _, r in top.iterrows()
    ]


def genre_cohort_benchmark(genre: str, budget: float) -> Optional[dict[str, Any]]:
    """Benchmark a budget against real genre peers in the dataset — used by the
    filmmaker analytics endpoint to compare an in-development movie against
    actual genre-level outcomes, instead of a fabricated estimate."""
    df = get_df()
    financial = df[df["has_financials"]]
    exploded = financial.explode("genres")
    peers = exploded[exploded["genres"].str.lower() == genre.lower()]
    if peers.empty:
        return None

    budget_percentile = round(float((peers["budget"] < budget).mean()) * 100, 1)
    return {
        "genre":                  genre,
        "peer_film_count":        int(len(peers)),
        "budget_percentile":      budget_percentile,
        "peer_avg_budget_musd":   round(float(peers["budget"].mean()) / 1e6, 1),
        "peer_avg_revenue_musd":  round(float(peers["revenue"].mean()) / 1e6, 1),
        "peer_avg_roi_pct":       round(float(peers["roi"].mean()), 1),
        "peer_loss_rate_pct":     round(float((peers["roi"] < 0).mean() * 100), 1),
    }


def filmography(person: str, role: str) -> list[dict[str, Any]]:
    """role: 'director' or 'actor' — sorted filmography for the person-detail expand view."""
    df = get_df()
    if role == "director":
        match = df[df["director"] == person]
    else:
        match = df[df["cast"].apply(lambda c: person in c)]
    match = match.dropna(subset=["year"]).sort_values("year")
    return [
        {"id": int(row["id"]), "title": row["title"], "year": int(row["year"]), "vote_average": float(row["vote_average"])}
        for _, row in match.iterrows()
    ]


# ─── Dashboard / overview / insights (Features 1, 9, 10) ──────────────────────
def dashboard_stats() -> dict[str, Any]:
    df = get_df()
    financial = df[df["has_financials"]]

    genres = genre_analytics()
    valid_year = df.dropna(subset=["year"])
    by_year = valid_year.groupby("year").agg(
        avg_revenue=("revenue", lambda s: s[s > 0].mean() if (s > 0).any() else 0),
        count=("id", "size"),
    )
    year_trend = []
    for y, row in by_year.sort_index().iterrows():
        year_trend.append({
            "year":  str(int(y)),
            "total": round(float(row["avg_revenue"]) * row["count"] / 1e6, 1),
            "avg":   round(float(row["avg_revenue"]) / 1e6, 1),
            "count": int(row["count"]),
        })

    return {
        "kpis": {
            "total_films":    int(len(df)),
            "avg_rating":     round(float(df["vote_average"].mean()), 2),
            "avg_revenue":    round(float(financial["revenue"].mean()), 0) if not financial.empty else 0,
            "peak_revenue":   round(float(financial["revenue"].max()), 0) if not financial.empty else 0,
            "total_revenue":  round(float(financial["revenue"].sum()), 0) if not financial.empty else 0,
            "avg_roi":        round(float(financial["roi"].mean()), 1) if not financial.empty else 0,
            "films_with_financials": int(len(financial)),
        },
        "year_trend":      year_trend,
        "genre_analytics": [
            {"genre": g["genre"], "avg_revenue": g["avg_revenue"], "count": g["count"]}
            for g in genres
        ],
    }


def _peak_window(exploded: pd.DataFrame, genre: str, window: int = 5) -> Optional[tuple[int, int]]:
    sub = exploded[exploded["genres"] == genre].dropna(subset=["year"])
    if sub.empty:
        return None
    by_year = sub.groupby("year")["popularity"].mean()
    years = sorted(by_year.index)
    if not years:
        return None
    best_start, best_avg = years[0], -1.0
    for start in years:
        window_years = [y for y in years if start <= y < start + window]
        avg = by_year.loc[window_years].mean()
        if avg > best_avg:
            best_avg, best_start = avg, start
    return int(best_start), int(best_start + window - 1)


def insights() -> list[str]:
    df = get_df()
    genres = genre_analytics()
    out: list[str] = []

    if genres:
        by_count = max(genres, key=lambda g: g["count"])
        pct = round(by_count["count"] / len(df) * 100, 1)
        out.append(f"{by_count['genre']} represents {pct}% of the catalog, the most common genre.")

        by_rating = max(genres, key=lambda g: g["avg_rating"])
        out.append(f"{by_rating['genre']} movies have the highest average rating at {by_rating['avg_rating']:.1f}.")

        by_pop = max(genres, key=lambda g: g["avg_popularity"])
        exploded = df.explode("genres")
        window = _peak_window(exploded, by_pop["genre"])
        if window:
            out.append(f"{by_pop['genre']} movies peaked in popularity between {window[0]} and {window[1]}.")

    # Ignore the sparse early-cinema tail (a handful of films per year skews
    # a first-year/last-year comparison) — anchor on years with meaningful volume.
    valid_year = df.dropna(subset=["year"])
    by_year = valid_year.groupby("year").size().sort_index()
    substantial = by_year[by_year >= 10]
    if len(substantial) >= 2:
        years = list(substantial.index)
        first_y, last_y = years[0], years[-1]
        first_v, last_v = substantial.iloc[0], substantial.iloc[-1]
        growth = round((last_v - first_v) / first_v * 100, 1)
        direction = "grew" if growth >= 0 else "declined"
        out.append(f"Annual movie production {direction} {abs(growth)}% from {int(first_y)} to {int(last_y)}.")

    financial = df[df["has_financials"]]
    if not financial.empty:
        coverage = round(len(financial) / len(df) * 100, 1)
        out.append(f"{coverage}% of films in the catalog have complete budget and revenue data.")

    return out


def overview() -> dict[str, Any]:
    df = get_df()
    genres = genre_analytics()
    financial = df[df["has_financials"]]
    valid_year = df.dropna(subset=["year"])

    top_movies_list = financial.sort_values("revenue", ascending=False).head(5)
    by_year_count = valid_year.groupby("year").size()
    most_active_years = by_year_count.sort_values(ascending=False).head(5)

    # Anchor "recent" on the latest year with meaningful volume, not the raw max
    # (a handful of far-future scheduled-release rows would otherwise dominate).
    substantial_years = by_year_count[by_year_count >= 10]
    recent_cutoff = int(substantial_years.index.max()) - 2 if not substantial_years.empty else 0
    trending = valid_year[valid_year["year"] >= recent_cutoff].sort_values("popularity", ascending=False).head(8)

    return {
        "coverage": {
            "total_movies":      int(len(df)),
            "year_range":        [int(valid_year["year"].min()), int(valid_year["year"].max())] if not valid_year.empty else None,
            "financial_coverage_pct": round(len(financial) / len(df) * 100, 1),
            "language_count":    int(df[df["original_language"] != ""]["original_language"].nunique()),
        },
        "top_genres": [{"genre": g["genre"], "count": g["count"]} for g in genres[:5]],
        "top_movies": [
            {"id": int(r["id"]), "title": r["title"], "revenue": float(r["revenue"])}
            for _, r in top_movies_list.iterrows()
        ],
        "most_active_years": [{"year": int(y), "count": int(c)} for y, c in most_active_years.items()],
        "insights": insights(),
        "trending": [_row_to_movie(r) for _, r in trending.iterrows()],
    }
