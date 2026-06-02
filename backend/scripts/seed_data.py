"""
FilmIQ — Database Seeder
Run: python scripts/seed_data.py
Seeds: genres (with ML coefficients), top movies from TMDB CSV, demo admin user
"""

import asyncio
import sys
import os
import csv
import ast
import logging

# Resolve paths so this script works when run from:
#   - project root:        python backend/scripts/seed_data.py
#   - backend/ directory:  python scripts/seed_data.py
#   - Docker /app:         python scripts/seed_data.py
_here    = os.path.dirname(os.path.abspath(__file__))   # .../scripts/
_backend = os.path.dirname(_here)                        # .../backend/ or /app
_root    = os.path.dirname(_backend)                     # project root (may be / in Docker)
for _p in (_backend, _root):
    if _p and os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import engine, Base, AsyncSessionLocal
from models import User, Movie, Genre, MovieGenre, Person, MovieCast, MovieCrew
import bcrypt

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("seed")

# ── Genre data (with paper's MLR coefficients from Table 6) ──────────────────
GENRES = [
    {"name": "Action",         "slug": "action",          "avg_revenue": 160_000_000, "avg_roi": 521, "mlr_coefficient":  0.222,  "risk_score": 52},
    {"name": "Adventure",      "slug": "adventure",       "avg_revenue": 226_000_000, "avg_roi": 812, "mlr_coefficient": -0.322,  "risk_score": 45},
    {"name": "Animation",      "slug": "animation",       "avg_revenue": 171_000_000, "avg_roi": 643, "mlr_coefficient":  0.110,  "risk_score": 38},
    {"name": "Comedy",         "slug": "comedy",          "avg_revenue": 121_000_000, "avg_roi": 320, "mlr_coefficient":  0.433,  "risk_score": 35},
    {"name": "Crime",          "slug": "crime",           "avg_revenue":  55_000_000, "avg_roi": 180, "mlr_coefficient":  0.522,  "risk_score": 48},
    {"name": "Drama",          "slug": "drama",           "avg_revenue":  78_000_000, "avg_roi": 180, "mlr_coefficient":  0.013,  "risk_score": 22},
    {"name": "Family",         "slug": "family",          "avg_revenue": 195_000_000, "avg_roi": 580, "mlr_coefficient":  0.202,  "risk_score": 30},
    {"name": "Fantasy",        "slug": "fantasy",         "avg_revenue": 168_000_000, "avg_roi": 490, "mlr_coefficient": -0.126,  "risk_score": 42},
    {"name": "Horror",         "slug": "horror",          "avg_revenue":  48_000_000, "avg_roi": 280, "mlr_coefficient": -0.500,  "risk_score": 40},
    {"name": "Romance",        "slug": "romance",         "avg_revenue":  92_000_000, "avg_roi": 210, "mlr_coefficient":  0.520,  "risk_score": 28},
    {"name": "Science Fiction","slug": "science-fiction", "avg_revenue": 183_000_000, "avg_roi": 490, "mlr_coefficient":  0.094,  "risk_score": 60},
    {"name": "Thriller",       "slug": "thriller",        "avg_revenue":  61_000_000, "avg_roi": -12, "mlr_coefficient": -1.121,  "risk_score": 68},
    {"name": "War",            "slug": "war",             "avg_revenue":  82_000_000, "avg_roi": 150, "mlr_coefficient":  0.025,  "risk_score": 55},
    {"name": "Music",          "slug": "music",           "avg_revenue": 107_000_000, "avg_roi": 250, "mlr_coefficient":  0.180,  "risk_score": 32},
    {"name": "Documentary",    "slug": "documentary",     "avg_revenue":  18_000_000, "avg_roi":  90, "mlr_coefficient": -0.200,  "risk_score": 35},
]

# ── Top 20 seeded movies ──────────────────────────────────────────────────────
SEED_MOVIES = [
    {"tmdb_id": 19995,  "title": "Avatar",                      "budget": 237_000_000, "revenue": 2_923_706_026, "vote_average": 7.59, "release_date": "2009-12-18", "director": "James Cameron",   "genres": ["Action","Adventure","Fantasy","Science Fiction"]},
    {"tmdb_id": 299534, "title": "Avengers: Endgame",           "budget": 356_000_000, "revenue": 2_799_439_100, "vote_average": 8.25, "release_date": "2019-04-26", "director": "Anthony Russo",   "genres": ["Adventure","Action","Science Fiction"]},
    {"tmdb_id": 76600,  "title": "Avatar: The Way of Water",    "budget": 460_000_000, "revenue": 2_320_250_281, "vote_average": 7.61, "release_date": "2022-12-16", "director": "James Cameron",   "genres": ["Science Fiction","Adventure","Action"]},
    {"tmdb_id": 597,    "title": "Titanic",                     "budget": 200_000_000, "revenue": 2_264_162_353, "vote_average": 7.91, "release_date": "1997-11-19", "director": "James Cameron",   "genres": ["Drama","Romance"]},
    {"tmdb_id": 140607, "title": "Star Wars: The Force Awakens","budget": 245_000_000, "revenue": 2_068_223_624, "vote_average": 7.26, "release_date": "2015-12-18", "director": "J.J. Abrams",     "genres": ["Adventure","Action","Science Fiction"]},
    {"tmdb_id": 299536, "title": "Avengers: Infinity War",      "budget": 300_000_000, "revenue": 2_052_415_039, "vote_average": 8.30, "release_date": "2018-04-27", "director": "Anthony Russo",   "genres": ["Adventure","Action","Science Fiction"]},
    {"tmdb_id": 135397, "title": "Jurassic World",              "budget": 150_000_000, "revenue": 1_670_516_444, "vote_average": 6.95, "release_date": "2015-06-12", "director": "Colin Trevorrow", "genres": ["Action","Adventure","Science Fiction"]},
    {"tmdb_id": 420818, "title": "The Lion King",               "budget": 250_000_000, "revenue": 1_663_075_401, "vote_average": 6.97, "release_date": "2019-07-19", "director": "Jon Favreau",     "genres": ["Family","Animation"]},
    {"tmdb_id": 24428,  "title": "The Avengers",                "budget": 220_000_000, "revenue": 1_519_557_910, "vote_average": 7.71, "release_date": "2012-05-04", "director": "Joss Whedon",     "genres": ["Action","Adventure","Science Fiction"]},
    {"tmdb_id": 168259, "title": "Furious 7",                   "budget": 190_000_000, "revenue": 1_515_047_671, "vote_average": 7.30, "release_date": "2015-04-03", "director": "James Wan",       "genres": ["Action","Crime","Thriller"]},
    {"tmdb_id": 351286, "title": "Jurassic World: Fallen Kingdom","budget":170_000_000,"revenue":1_309_484_461, "vote_average": 6.40, "release_date": "2018-06-06", "director": "J.A. Bayona",     "genres": ["Action","Adventure","Science Fiction"]},
    {"tmdb_id": 118340, "title": "Guardians of the Galaxy",     "budget": 170_000_000, "revenue":   773_328_629, "vote_average": 7.91, "release_date": "2014-08-01", "director": "James Gunn",      "genres": ["Action","Adventure","Comedy","Science Fiction"]},
    {"tmdb_id": 284054, "title": "Black Panther",               "budget": 200_000_000, "revenue": 1_346_739_107, "vote_average": 7.40, "release_date": "2018-02-16", "director": "Ryan Coogler",    "genres": ["Action","Adventure","Fantasy","Science Fiction"]},
    {"tmdb_id": 315635, "title": "Spider-Man: Homecoming",      "budget": 175_000_000, "revenue":   880_166_924, "vote_average": 7.28, "release_date": "2017-07-07", "director": "Jon Watts",       "genres": ["Action","Adventure","Comedy","Science Fiction"]},
    {"tmdb_id": 399579, "title": "Alita: Battle Angel",         "budget": 170_000_000, "revenue":   404_852_543, "vote_average": 7.30, "release_date": "2019-02-14", "director": "Robert Rodriguez","genres": ["Action","Adventure","Science Fiction"]},
    {"tmdb_id": 385687, "title": "Fast X",                      "budget": 340_000_000, "revenue":   704_709_660, "vote_average": 7.10, "release_date": "2023-05-19", "director": "Louis Leterrier", "genres": ["Action","Crime","Thriller"]},
    {"tmdb_id": 27205,  "title": "Inception",                   "budget": 160_000_000, "revenue":   836_836_967, "vote_average": 8.36, "release_date": "2010-07-16", "director": "Christopher Nolan","genres":["Action","Adventure","Science Fiction","Thriller"]},
    {"tmdb_id": 155,    "title": "The Dark Knight",             "budget": 185_000_000, "revenue": 1_004_558_444, "vote_average": 8.52, "release_date": "2008-07-18", "director": "Christopher Nolan","genres":["Drama","Action","Crime","Thriller"]},
    {"tmdb_id": 438631, "title": "Dune: Part One",              "budget": 165_000_000, "revenue":   401_783_161, "vote_average": 7.78, "release_date": "2021-10-22", "director": "Denis Villeneuve","genres": ["Science Fiction","Adventure"]},
    {"tmdb_id": 693134, "title": "Dune: Part Two",              "budget": 190_000_000, "revenue":   711_844_634, "vote_average": 8.20, "release_date": "2024-03-01", "director": "Denis Villeneuve","genres": ["Science Fiction","Adventure"]},
]


async def seed_genres(db: AsyncSession) -> dict[str, int]:
    """Insert genres, return name→id map."""
    log.info("Seeding genres...")
    genre_map: dict[str, int] = {}
    for g in GENRES:
        existing = await db.execute(select(Genre).where(Genre.name == g["name"]))
        row = existing.scalar_one_or_none()
        if not row:
            row = Genre(**g)
            db.add(row)
            await db.flush()
        genre_map[g["name"]] = row.id
    await db.commit()
    log.info(f"  → {len(GENRES)} genres seeded")
    return genre_map


async def seed_movies(db: AsyncSession, genre_map: dict[str, int]) -> None:
    """Insert top movies with director persons and genre links."""
    log.info("Seeding movies...")
    count = 0
    for m in SEED_MOVIES:
        existing = await db.execute(select(Movie).where(Movie.tmdb_id == m["tmdb_id"]))
        if existing.scalar_one_or_none():
            continue

        movie = Movie(
            tmdb_id=m["tmdb_id"],
            title=m["title"],
            budget=m["budget"],
            revenue=m["revenue"],
            roi=round((m["revenue"] - m["budget"]) / m["budget"] * 100, 1),
            vote_average=m["vote_average"],
            release_date=m["release_date"],
            original_language="en",
        )
        db.add(movie)
        await db.flush()

        # Link genres
        for genre_name in m["genres"]:
            if genre_name in genre_map:
                db.add(MovieGenre(movie_id=movie.id, genre_id=genre_map[genre_name]))

        # Director
        director_name = m.get("director", "")
        if director_name:
            d_res = await db.execute(select(Person).where(Person.name == director_name))
            director = d_res.scalar_one_or_none()
            if not director:
                director = Person(name=director_name, known_for_department="Directing")
                db.add(director)
                await db.flush()
            db.add(MovieCrew(movie_id=movie.id, person_id=director.id, department="Directing", job="Director"))

        count += 1

    await db.commit()
    log.info(f"  → {count} movies seeded")


async def seed_admin_user(db: AsyncSession) -> None:
    """Create default admin account."""
    log.info("Seeding admin user...")
    existing = await db.execute(select(User).where(User.email == "admin@filmiq.africa"))
    if existing.scalar_one_or_none():
        log.info("  → admin already exists, skipping")
        return

    admin = User(
        email="admin@filmiq.africa",
        username="filmiq_admin",
        hashed_password=bcrypt.hashpw(b"filmiq_admin_2025", bcrypt.gensalt()).decode(),
        full_name="FilmIQ Administrator",
        role="admin",
        organisation="FilmIQ",
        country="Uganda",
        is_active=True,
    )
    db.add(admin)

    # Demo analyst user
    analyst = User(
        email="analyst@filmiq.africa",
        username="demo_analyst",
        hashed_password=bcrypt.hashpw(b"demo1234", bcrypt.gensalt()).decode(),
        full_name="Demo Analyst",
        role="analyst",
        organisation="FilmIQ Demo",
        country="Uganda",
        is_active=True,
    )
    db.add(analyst)

    await db.commit()
    log.info("  → admin@filmiq.africa (pw: filmiq_admin_2025)")
    log.info("  → analyst@filmiq.africa (pw: demo1234)")


async def seed_from_csv(db: AsyncSession, csv_path: str, genre_map: dict[str, int]) -> None:
    """Optionally seed from full TMDB CSV if available."""
    if not os.path.exists(csv_path):
        log.info(f"CSV not found at {csv_path} — skipping bulk import")
        return

    log.info(f"Bulk seeding from {csv_path}...")
    count = 0
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                budget  = float(row.get("budget") or 0)
                revenue = float(row.get("revenue") or 0)
                if budget < 100_000 or revenue < 100_000:
                    continue
                tmdb_id = int(float(row.get("id") or 0))
                existing = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
                if existing.scalar_one_or_none():
                    continue

                movie = Movie(
                    tmdb_id=tmdb_id,
                    title=row.get("title", "Unknown"),
                    budget=budget,
                    revenue=revenue,
                    roi=round((revenue - budget) / budget * 100, 1),
                    vote_average=float(row.get("vote_average") or 0),
                    vote_count=int(float(row.get("vote_count") or 0)),
                    popularity=float(row.get("popularity") or 0),
                    release_date=row.get("release_date", ""),
                    original_language=row.get("original_language", "en"),
                    overview=row.get("overview", ""),
                    runtime=int(float(row.get("runtime") or 0)) or None,
                )
                db.add(movie)
                await db.flush()

                # Genre links
                try:
                    genres = ast.literal_eval(row.get("genres", "[]"))
                    for g in genres:
                        if g in genre_map:
                            db.add(MovieGenre(movie_id=movie.id, genre_id=genre_map[g]))
                except Exception:
                    pass

                count += 1
                if count % 500 == 0:
                    await db.commit()
                    log.info(f"  → {count} movies imported...")

            except Exception as e:
                continue

    await db.commit()
    log.info(f"  → CSV import complete: {count} movies")


async def main():
    log.info("=== FilmIQ Database Seeder ===")

    # Ensure tables exist (idempotent for dev)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        genre_map  = await seed_genres(db)
        await seed_movies(db, genre_map)
        await seed_admin_user(db)

        # Optional: bulk CSV import
        csv_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "dataset_1_collected_data.csv"
        )
        await seed_from_csv(db, csv_path, genre_map)

    log.info("=== Seeding complete ===")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
