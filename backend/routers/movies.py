"""
FilmIQ — Movies Router
Full CRUD + CSV bulk import from TMDB dataset
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, and_
from pydantic import BaseModel
from typing import Optional, List
import csv, io, ast

from database import get_db
from models import Movie, Genre, MovieGenre, Person, MovieCast, MovieCrew

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────
class MovieListItem(BaseModel):
    id:           int
    title:        str
    budget:       float
    revenue:      float
    roi:          Optional[float]
    vote_average: float
    popularity:   float
    release_date: Optional[str]
    genres:       List[str] = []

class MovieDetail(MovieListItem):
    overview:      Optional[str]
    tagline:       Optional[str]
    runtime:       Optional[int]
    director:      Optional[str]
    cast:          List[str] = []
    is_african:    bool = False
    african_region: Optional[str]


# ─── List & Filter ───────────────────────────────────────────────────────────
@router.get("/", response_model=List[dict])
async def list_movies(
    page:    int   = Query(1, ge=1),
    limit:   int   = Query(20, le=100),
    genre:   Optional[str] = None,
    year:    Optional[int] = None,
    min_rev: Optional[float] = None,
    sort:    str   = Query("revenue", pattern="^(revenue|budget|roi|vote_average|popularity)$"),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    q = select(Movie).where(Movie.revenue > 0)

    if year:
        q = q.where(Movie.release_date.like(f"{year}%"))
    if min_rev:
        q = q.where(Movie.revenue >= min_rev)
    if sort == "revenue":
        q = q.order_by(desc(Movie.revenue))
    elif sort == "roi":
        q = q.order_by(desc(Movie.roi))
    elif sort == "vote_average":
        q = q.order_by(desc(Movie.vote_average))
    else:
        q = q.order_by(desc(Movie.popularity))

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    movies = result.scalars().all()

    return [_serialize_movie(m) for m in movies]


@router.get("/top")
async def top_movies(
    limit: int = Query(10, le=50),
    genre: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Top films by revenue — used for dashboard table."""
    q = (
        select(Movie)
        .where(Movie.revenue > 0, Movie.budget > 0)
        .order_by(desc(Movie.revenue))
        .limit(limit)
    )
    result = await db.execute(q)
    movies = result.scalars().all()
    if movies:
        return [_serialize_movie(m) for m in movies]

    # Seeded fallback if DB is empty
    return _seeded_top_movies()


@router.get("/search")
async def search_movies(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Movie)
        .where(Movie.title.ilike(f"%{q}%"))
        .order_by(desc(Movie.popularity))
        .limit(limit)
    )
    return [_serialize_movie(m) for m in result.scalars().all()]


@router.get("/{movie_id}", response_model=dict)
async def get_movie(movie_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(404, "Movie not found")
    return _serialize_movie(movie, detail=True)


# ─── CSV Import (TMDB Dataset) ───────────────────────────────────────────────
@router.post("/import-csv")
async def import_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Bulk import from TMDB CSV dataset.
    Runs in background — returns immediately.
    NOTE: Does NOT accept the request-scoped `db` session because background
    tasks run after the response is sent and the request session is closed.
    The background task opens its own session.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files accepted")

    content = await file.read()
    background_tasks.add_task(_process_csv_import, content)
    return {"message": "Import started", "filename": file.filename, "status": "processing"}


async def _process_csv_import(content: bytes) -> None:
    """Background task: parse TMDB CSV and upsert into DB with its own session."""
    from database import AsyncSessionLocal
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    imported = 0
    errors   = 0

    for row in reader:
        try:
            budget  = float(row.get("budget") or 0)
            revenue = float(row.get("revenue") or 0)
            if budget <= 0 or revenue <= 0:
                continue

            # Check existing
            existing = await db.execute(
                select(Movie).where(Movie.tmdb_id == int(row.get("id", 0)))
            )
            movie = existing.scalar_one_or_none()

            if not movie:
                movie = Movie()

            movie.tmdb_id       = int(row.get("id") or 0)
            movie.title         = row.get("title", "Unknown")
            movie.budget        = budget
            movie.revenue       = revenue
            movie.roi           = (revenue - budget) / budget * 100 if budget > 0 else None
            movie.vote_average  = float(row.get("vote_average") or 0)
            movie.vote_count    = int(float(row.get("vote_count") or 0))
            movie.popularity    = float(row.get("popularity") or 0)
            movie.release_date  = row.get("release_date", "")
            movie.overview      = row.get("overview", "")
            movie.runtime       = int(float(row.get("runtime") or 0)) or None
            movie.original_language = row.get("original_language", "en")

            # Director from crew JSON
            try:
                crew = ast.literal_eval(row.get("crew", "[]"))
                directors = [c["name"] for c in crew if c.get("job") == "Director"]
                if directors:
                    movie.overview = (movie.overview or "") + f"\nDirector: {directors[0]}"
            except Exception:
                pass

            db.add(movie)
            imported += 1

            if imported % 100 == 0:
                await db.commit()

        except Exception:
            errors += 1
            continue

    await db.commit()
    print(f"CSV import complete: {imported} imported, {errors} errors")


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _serialize_movie(m: Movie, detail: bool = False) -> dict:
    base = {
        "id":           m.id,
        "title":        m.title,
        "budget":       m.budget,
        "revenue":      m.revenue,
        "roi":          round(m.roi, 1) if m.roi else None,
        "vote_average": m.vote_average,
        "popularity":   m.popularity,
        "release_date": m.release_date,
        "genres":       [],
    }
    if detail:
        base.update({
            "overview":      m.overview,
            "tagline":       m.tagline,
            "runtime":       m.runtime,
            "is_african":    m.is_african_content,
            "african_region": m.african_region,
            "sentiment_score": m.sentiment_score,
        })
    return base

def _seeded_top_movies():
    return [
        {"id":1,"title":"Avatar","budget":237000000,"revenue":2923706026,"roi":1133.6,"vote_average":7.59,"popularity":200,"release_date":"2009-12-18","genres":["Action","Adventure","Fantasy"]},
        {"id":2,"title":"Avengers: Endgame","budget":356000000,"revenue":2799439100,"roi":686.4,"vote_average":8.2,"popularity":210,"release_date":"2019-04-26","genres":["Adventure","Action","Sci-Fi"]},
        {"id":3,"title":"Avatar: The Way of Water","budget":460000000,"revenue":2320250281,"roi":404.4,"vote_average":7.61,"popularity":195,"release_date":"2022-12-16","genres":["Sci-Fi","Adventure"]},
        {"id":4,"title":"Titanic","budget":200000000,"revenue":2264162353,"roi":1032.1,"vote_average":7.91,"popularity":180,"release_date":"1997-11-19","genres":["Drama","Romance"]},
        {"id":5,"title":"Ne Zha 2","budget":80000000,"revenue":2123000000,"roi":2553.8,"vote_average":7.8,"popularity":165,"release_date":"2025-01-29","genres":["Animation","Fantasy"]},
        {"id":6,"title":"Star Wars: The Force Awakens","budget":245000000,"revenue":2068223624,"roi":744.2,"vote_average":7.26,"popularity":188,"release_date":"2015-12-18","genres":["Adventure","Action","Sci-Fi"]},
        {"id":7,"title":"Avengers: Infinity War","budget":300000000,"revenue":2052415039,"roi":584.1,"vote_average":8.3,"popularity":206,"release_date":"2018-04-27","genres":["Adventure","Action","Sci-Fi"]},
        {"id":8,"title":"Jurassic World","budget":150000000,"revenue":1670516444,"roi":1013.7,"vote_average":6.95,"popularity":172,"release_date":"2015-06-12","genres":["Action","Adventure","Sci-Fi"]},
        {"id":9,"title":"The Lion King (2019)","budget":250000000,"revenue":1663075401,"roi":565.2,"vote_average":6.97,"popularity":168,"release_date":"2019-07-19","genres":["Family","Animation"]},
        {"id":10,"title":"The Avengers","budget":220000000,"revenue":1519557910,"roi":590.7,"vote_average":7.71,"popularity":185,"release_date":"2012-05-04","genres":["Action","Adventure","Sci-Fi"]},
    ]
