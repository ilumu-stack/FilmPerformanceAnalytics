"""
FilmIQ — Database Models (SQLAlchemy ORM)
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

# Import the single shared Base so all models register on the same metadata
# This is critical for Alembic migrations and engine.create_all()
from database import Base


# ──────────────────────────────────────────────
# ENUMS
# ──────────────────────────────────────────────
class UserRole(str, enum.Enum):
    admin     = "admin"
    analyst   = "analyst"
    investor  = "investor"
    filmmaker = "filmmaker"

class SentimentLabel(str, enum.Enum):
    positive = "positive"
    neutral  = "neutral"
    negative = "negative"

class PredictionStatus(str, enum.Enum):
    pending   = "pending"
    completed = "completed"
    failed    = "failed"


# ──────────────────────────────────────────────
# USERS
# ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    username      = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name     = Column(String(200))
    role          = Column(String(50), default=UserRole.analyst.value)
    organisation  = Column(String(200))
    country       = Column(String(100), default="Uganda")
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())
    last_login    = Column(DateTime(timezone=True), nullable=True)

    predictions   = relationship("Prediction", back_populates="user")
    reports       = relationship("Report", back_populates="user")


# ──────────────────────────────────────────────
# GENRES
# ──────────────────────────────────────────────
class Genre(Base):
    __tablename__ = "genres"

    id     = Column(Integer, primary_key=True, index=True)
    name   = Column(String(100), unique=True, nullable=False)
    slug   = Column(String(100), unique=True)
    # Avg performance metrics from dataset
    avg_revenue       = Column(Float, default=0)
    avg_roi           = Column(Float, default=0)
    mlr_coefficient   = Column(Float, default=0)   # from research paper Table 6
    risk_score        = Column(Float, default=50)   # 0-100

    movies = relationship("MovieGenre", back_populates="genre")


# ──────────────────────────────────────────────
# MOVIES
# ──────────────────────────────────────────────
class Movie(Base):
    __tablename__ = "movies"

    id                   = Column(Integer, primary_key=True, index=True)
    tmdb_id              = Column(Integer, unique=True, index=True)
    title                = Column(String(500), nullable=False, index=True)
    original_title       = Column(String(500))
    overview             = Column(Text)
    tagline              = Column(String(500))
    budget               = Column(Float, default=0)
    revenue              = Column(Float, default=0)
    roi                  = Column(Float)            # computed
    runtime              = Column(Integer)
    release_date         = Column(String(20))
    original_language    = Column(String(10))
    vote_average         = Column(Float, default=0)
    vote_count           = Column(Integer, default=0)
    popularity           = Column(Float, default=0)
    poster_path          = Column(String(300))
    is_ip_adaptation     = Column(Boolean, default=False)
    production_countries = Column(JSON)             # list of country names
    production_companies = Column(JSON)             # list of company names
    # ML features
    heat_index           = Column(Float)
    intended_audience    = Column(Integer)
    sentiment_score      = Column(Float)
    first_day_box_office = Column(Float)
    positive_comments    = Column(Integer)
    neutral_comments     = Column(Integer)
    negative_comments    = Column(Integer)
    # African market flags
    is_african_content   = Column(Boolean, default=False)
    african_region       = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    genres      = relationship("MovieGenre", back_populates="movie")
    cast        = relationship("MovieCast", back_populates="movie")
    crew        = relationship("MovieCrew", back_populates="movie")
    predictions = relationship("Prediction", back_populates="movie")
    sentiments  = relationship("AudienceSentiment", back_populates="movie")
    streaming   = relationship("StreamingStats", back_populates="movie")


class MovieGenre(Base):
    __tablename__ = "movie_genres"
    movie_id = Column(Integer, ForeignKey("movies.id"), primary_key=True)
    genre_id = Column(Integer, ForeignKey("genres.id"), primary_key=True)
    movie = relationship("Movie", back_populates="genres")
    genre = relationship("Genre", back_populates="movies")


# ──────────────────────────────────────────────
# CAST & CREW
# ──────────────────────────────────────────────
class Person(Base):
    __tablename__ = "persons"

    id                   = Column(Integer, primary_key=True, index=True)
    tmdb_person_id       = Column(Integer, unique=True)
    name                 = Column(String(300), nullable=False, index=True)
    known_for_department = Column(String(100))
    nationality          = Column(String(100))
    # Computed scores
    popularity_score      = Column(Float, default=0)
    avg_film_revenue      = Column(Float, default=0)
    avg_roi               = Column(Float, default=0)
    total_box_office      = Column(Float, default=0)
    film_count            = Column(Integer, default=0)
    awards_count          = Column(Integer, default=0)
    mlr_contribution      = Column(Float, default=0)   # from paper: actors coeff 1.22

    cast_roles = relationship("MovieCast", back_populates="person")
    crew_roles = relationship("MovieCrew", back_populates="person")


class MovieCast(Base):
    __tablename__ = "movie_cast"
    id         = Column(Integer, primary_key=True, index=True)
    movie_id   = Column(Integer, ForeignKey("movies.id",  ondelete="CASCADE"))
    person_id  = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"))
    character  = Column(String(300))
    cast_order = Column(Integer)          # billing order
    movie  = relationship("Movie",  back_populates="cast")
    person = relationship("Person", back_populates="cast_roles")


class MovieCrew(Base):
    __tablename__ = "movie_crew"
    id        = Column(Integer, primary_key=True, index=True)
    movie_id  = Column(Integer, ForeignKey("movies.id",  ondelete="CASCADE"))
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"))
    department = Column(String(100))
    job        = Column(String(200))
    movie  = relationship("Movie",  back_populates="crew")
    person = relationship("Person", back_populates="crew_roles")


# ──────────────────────────────────────────────
# PREDICTIONS
# ──────────────────────────────────────────────
class Prediction(Base):
    __tablename__ = "predictions"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id",  ondelete="SET NULL"), nullable=True)
    movie_id            = Column(Integer, ForeignKey("movies.id", ondelete="SET NULL"), nullable=True)
    # Input features
    input_budget        = Column(Float)
    input_genre         = Column(String(100))
    input_director_score = Column(Float)
    input_cast_score    = Column(Float)
    input_season        = Column(String(50))
    input_market        = Column(String(100))
    input_logline       = Column(Text)
    # Model outputs
    predicted_revenue         = Column(Float)
    predicted_opening_weekend = Column(Float)
    predicted_roi             = Column(Float)
    confidence_score          = Column(Float)
    model_used                = Column(String(50), default="CNN-C")
    # Breakdown
    genre_multiplier    = Column(Float)
    sentiment_boost     = Column(Float)
    seasonal_multiplier = Column(Float)
    cast_multiplier     = Column(Float)
    # AI narrative
    ai_analysis         = Column(Text)
    risk_level          = Column(String(20))  # LOW / MODERATE / HIGH / VERY HIGH
    status              = Column(String(20), default=PredictionStatus.completed.value)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    user  = relationship("User",  back_populates="predictions")
    movie = relationship("Movie", back_populates="predictions")


# ──────────────────────────────────────────────
# AUDIENCE SENTIMENT
# ──────────────────────────────────────────────
class AudienceSentiment(Base):
    __tablename__ = "audience_sentiment"

    id               = Column(Integer, primary_key=True, index=True)
    movie_id         = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    source           = Column(String(50))    # twitter, youtube, letterboxd
    raw_text         = Column(Text)
    label            = Column(String(20))
    score            = Column(Float)         # −0.5 to +0.5 (paper formula)
    tfidf_weight     = Column(Float)         # emotional weight Tij
    weighted_score   = Column(Float)         # Fi = Wi × Σ(Tij + 1)
    days_before_release = Column(Integer)    # used for temporal weighting
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    movie = relationship("Movie", back_populates="sentiments")


# ──────────────────────────────────────────────
# STREAMING STATISTICS
# ──────────────────────────────────────────────
class StreamingStats(Base):
    __tablename__ = "streaming_stats"

    id           = Column(Integer, primary_key=True, index=True)
    movie_id     = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    platform     = Column(String(100))   # Netflix, Amazon, Showmax, etc.
    region       = Column(String(100))   # East Africa, West Africa, Global
    views_count  = Column(Integer, default=0)
    watch_hours  = Column(Float, default=0)
    peak_rank    = Column(Integer)
    revenue_usd  = Column(Float, default=0)
    period_start = Column(DateTime(timezone=True))
    period_end   = Column(DateTime(timezone=True))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    movie = relationship("Movie", back_populates="streaming")


# ──────────────────────────────────────────────
# INVESTORS
# ──────────────────────────────────────────────
class Investor(Base):
    __tablename__ = "investors"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    portfolio_value_usd = Column(Float, default=0)
    risk_tolerance      = Column(String(20), default="moderate")  # low/moderate/high
    preferred_genres    = Column(JSON)
    preferred_regions   = Column(JSON)
    total_invested      = Column(Float, default=0)
    total_returns       = Column(Float, default=0)
    roi_to_date         = Column(Float, default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


# ──────────────────────────────────────────────
# REPORTS
# ──────────────────────────────────────────────
class Report(Base):
    __tablename__ = "reports"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title       = Column(String(300))
    report_type = Column(String(100))  # analytics, prediction, investor
    filters     = Column(JSON)
    data_snapshot = Column(JSON)
    file_path   = Column(String(500))  # PDF export path
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reports")
