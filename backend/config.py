"""
FilmIQ — Application Configuration
Reads from environment variables / .env file.
Usage: from config import settings

DOCKER NOTE: Uses env vars directly; Path(__file__) is unreliable when
the package is copied into a Docker image at a different path.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Search for .env in CWD first, then one level up — works both locally
        # (CWD=backend/) and in Docker (CWD=/app where .env is volume-mounted)
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    app_name:    str  = "FilmIQ"
    app_version: str  = "1.0.0"
    environment: str  = "development"
    debug:       bool = False
    log_level:   str  = "INFO"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://filmiq_user:filmiq_secret@localhost:5432/filmiq"
    )
    db_pool_size:    int  = 10
    db_max_overflow: int  = 20
    db_echo:         bool = False

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url:      str = "redis://localhost:6379/0"
    cache_ttl_secs: int = 300

    # ── Security / JWT ────────────────────────────────────────────────────────
    jwt_secret:    str = "CHANGE_ME_IN_PRODUCTION_USE_OPENSSL_RAND_HEX_64"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes:  int = 60
    refresh_token_expire_days:    int = 30

    # ── Anthropic Claude ──────────────────────────────────────────────────────
    anthropic_api_key:    str = ""
    anthropic_model:      str = "claude-sonnet-4-20250514"
    anthropic_max_tokens: int = 1000

    # ── TMDB ─────────────────────────────────────────────────────────────────
    tmdb_api_key:       str = ""
    tmdb_base_url:      str = "https://api.themoviedb.org/3"
    tmdb_image_base_url:str = "https://image.tmdb.org/t/p/w500"

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://filmiq.africa",
        "https://www.filmiq.africa",
    ]

    # ── ML ───────────────────────────────────────────────────────────────────
    # Use env var ML_MODEL_PATH; default works locally and in Docker
    # Docker sets this to /app/ml/saved_models via docker-compose environment:
    ml_model_path: str = "ml/saved_models"
    retrain_on_startup: bool = False

    # ── File Upload ───────────────────────────────────────────────────────────
    upload_dir:     str       = "/tmp/filmiq_uploads"
    max_upload_mb:  int       = 50
    allowed_extensions: list[str] = [".csv", ".json"]

    # ── Pagination ────────────────────────────────────────────────────────────
    default_page_size: int = 20
    max_page_size:     int = 100

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def sqlalchemy_url(self) -> str:
        """Ensure async driver is specified."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def resolved_ml_model_path(self) -> str:
        """Return absolute path, resolving relative paths from CWD."""
        p = Path(self.ml_model_path)
        if p.is_absolute():
            return str(p)
        # Relative: resolve from the directory containing this file's package
        # In Docker: /app/config.py → /app/ml/saved_models
        # Locally:   backend/config.py → backend/../ml/saved_models = ml/saved_models
        return str(Path(__file__).parent / self.ml_model_path)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
