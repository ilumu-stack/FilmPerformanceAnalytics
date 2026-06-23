"""
FilmIQ — Application Configuration (Firestore edition)
Reads from environment variables / .env file.
Usage: from config import settings
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
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

    # ── Firebase ─────────────────────────────────────────────────────────────
    # Set ONE of these:
    #   FIREBASE_CREDENTIALS      — full service-account JSON as a string
    #   FIREBASE_CREDENTIALS_PATH — path to service-account JSON file
    #   FIREBASE_PROJECT_ID       — use Application Default Credentials
    firebase_project_id:       str = ""
    firebase_credentials:      str = ""
    firebase_credentials_path: str = ""

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url:      str = "redis://localhost:6379/0"
    cache_ttl_secs: int = 300

    # ── Security / JWT ────────────────────────────────────────────────────────
    jwt_secret:    str = "CHANGE_ME_IN_PRODUCTION_USE_OPENSSL_RAND_HEX_64"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes:  int = 60
    refresh_token_expire_days:    int = 30

    # ── Default admin bootstrap (dev-only defaults; override via env in prod) ─
    # The created account always has must_change_password=True, so this is a
    # one-time bootstrap credential, not a standing password.
    default_admin_email:    str = "admin@filmiq.africa"
    default_admin_password: str = "Admin@123"

    # ── Anthropic Claude ──────────────────────────────────────────────────────
    anthropic_api_key:    str = ""
    anthropic_model:      str = "claude-sonnet-4-20250514"
    anthropic_max_tokens: int = 1000

    # ── TMDB ─────────────────────────────────────────────────────────────────
    tmdb_api_key:           str = ""
    tmdb_base_url:          str = "https://api.themoviedb.org/3"
    tmdb_image_base_url:    str = "https://image.tmdb.org/t/p/w500"     # posters
    tmdb_backdrop_base_url: str = "https://image.tmdb.org/t/p/original"  # hero/backdrops

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://filmiq.africa",
        "https://www.filmiq.africa",
    ]

    # ── ML ───────────────────────────────────────────────────────────────────
    ml_model_path:      str  = "ml/saved_models"
    retrain_on_startup: bool = False

    # ── File Upload ───────────────────────────────────────────────────────────
    upload_dir:         str       = "/tmp/filmiq_uploads"
    max_upload_mb:      int       = 50
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
    def resolved_ml_model_path(self) -> str:
        p = Path(self.ml_model_path)
        if p.is_absolute():
            return str(p)
        return str(Path(__file__).parent / self.ml_model_path)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
