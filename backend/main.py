"""
FilmIQ — African Cinema Intelligence Platform
FastAPI Backend — main.py
"""

import sys
from pathlib import Path

# Local dev: ml/ lives at filmiq/ml/, one level above backend/.
# In Docker it is bind-mounted into /app/ml/ (same dir), so this is a no-op there.
_project_root = Path(__file__).parent.parent
if (_project_root / "ml").is_dir() and str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.exc import SQLAlchemyError
import logging
import uvicorn

from routers import auth, movies, predictions, analytics, sentiment, investors, admin, chat
from database import engine, Base
from config import settings

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("filmiq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting FilmIQ v{settings.app_version} ({settings.environment})")
    if settings.is_development:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables verified (development auto-create)")
        except Exception as e:
            # DB might not be up yet; Alembic handles schema in production.
            logger.warning("Startup DB check skipped (DB not reachable): %s", e)
    yield
    logger.info("FilmIQ shutting down")
    await engine.dispose()


app = FastAPI(
    title="FilmIQ API",
    description="African Cinema Intelligence Platform — Box Office Prediction & Analytics",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs"  if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# ── DB connection error → 503 (not a raw 500) ────────────────────────────────
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.error("Database error on %s %s: %s", request.method, request.url.path, exc)
    # ConnectionRefusedError / OperationalError means the DB is unreachable
    msg = str(exc.__cause__ or exc)
    if any(kw in msg.lower() for kw in ("connection refused", "could not connect", "connect call failed")):
        return JSONResponse(
            status_code=503,
            content={"detail": "Database unavailable. Ensure the PostgreSQL container is running."},
        )
    return JSONResponse(status_code=500, content={"detail": "A database error occurred."})


# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["filmiq.africa", "*.filmiq.africa", "localhost"],
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/auth",       tags=["Authentication"])
app.include_router(movies.router,      prefix="/api/movies",     tags=["Movies"])
app.include_router(predictions.router, prefix="/api/predict",    tags=["AI Predictions"])
app.include_router(analytics.router,   prefix="/api/analytics",  tags=["Analytics"])
app.include_router(sentiment.router,   prefix="/api/sentiment",  tags=["Sentiment"])
app.include_router(investors.router,   prefix="/api/investors",  tags=["Investor Intel"])
app.include_router(admin.router,       prefix="/api/admin",      tags=["Admin"])
app.include_router(chat.router,        prefix="/api/chat",       tags=["AI Chat"])

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "operational", "platform": "FilmIQ", "version": settings.app_version}


@app.get("/health", tags=["Health"])
async def health():
    import os
    ml_path = settings.resolved_ml_model_path
    ml_ok   = os.path.exists(os.path.join(ml_path, "random_forest.pkl"))
    return {
        "status":      "healthy",
        "environment": settings.environment,
        "ml_models":   "loaded" if ml_ok else "fallback (analytical)",
        "version":     settings.app_version,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
    )
