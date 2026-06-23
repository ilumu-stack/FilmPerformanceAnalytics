"""
FilmIQ — Uganda's Cinema Intelligence Platform
FastAPI Backend — main.py (Firestore edition)
"""

import sys
from pathlib import Path

# Local dev: ml/ lives at filmiq/ml/, one level above backend/.
_project_root = Path(__file__).parent.parent
if (_project_root / "ml").is_dir() and str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import logging
import uvicorn

from routers import auth, movies, predictions, analytics, sentiment, investors, admin, chat, data_portal
from config import settings

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("filmiq")


async def _ensure_default_admin() -> None:
    """
    Ensure the default admin exists in BOTH Firebase Authentication and Firestore.
    Checks each store independently so a partial state (e.g. Firestore-only) is repaired.
    Credentials come from settings.default_admin_email / default_admin_password
    (env-overridable; see config.py). The created account always has
    must_change_password=True, so this is a one-time bootstrap credential.
    """
    import asyncio
    from firebase_db import db
    from firebase_admin import firestore, auth as firebase_auth
    from google.cloud.firestore_v1.base_query import FieldFilter
    from auth_utils import hash_password

    ADMIN_EMAIL    = settings.default_admin_email
    ADMIN_PASSWORD = settings.default_admin_password

    try:
        # ── Step 1: Firebase Authentication ──────────────────────────────────
        # Check if admin exists; if not (any error), attempt to create.
        _admin_in_fb = False
        try:
            await asyncio.to_thread(firebase_auth.get_user_by_email, ADMIN_EMAIL)
            _admin_in_fb = True
        except Exception:
            pass  # user not found or auth not reachable — try create below

        if not _admin_in_fb:
            try:
                await asyncio.to_thread(
                    firebase_auth.create_user,
                    email=ADMIN_EMAIL,
                    password=ADMIN_PASSWORD,
                    display_name="Administrator",
                )
                logger.info("Default admin created in Firebase Auth — email: %s", ADMIN_EMAIL)
            except Exception as create_exc:
                logger.warning(
                    "Could not create admin in Firebase Auth: %s — "
                    "Go to Firebase Console → Authentication → Sign-in method → "
                    "enable Email/Password, then restart.",
                    create_exc,
                )

        # ── Step 2: Firestore ─────────────────────────────────────────────────
        docs = await db.collection("users").where(
            filter=FieldFilter("role", "==", "admin")
        ).limit(1).get()

        if not docs:
            doc_ref = db.collection("users").document()
            await doc_ref.set({
                "email":                ADMIN_EMAIL,
                "username":             "admin",
                "hashed_password":      hash_password(ADMIN_PASSWORD),
                "full_name":            "Administrator",
                "role":                 "admin",
                "organisation":         None,
                "country":              "Uganda",
                "is_active":            True,
                "must_change_password": True,
                "created_at":           firestore.SERVER_TIMESTAMP,
                "updated_at":           None,
                "last_login":           None,
            })
            logger.info(
                "Default admin created in Firestore — username: admin. "
                "Bootstrap password is set via DEFAULT_ADMIN_PASSWORD env var "
                "(must_change_password=True, change it on first login)."
            )

    except Exception as exc:
        logger.warning("Default admin setup skipped: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting FilmIQ v%s (%s)", settings.app_version, settings.environment)
    _PLACEHOLDER_JWT_SECRETS = {
        "CHANGE_ME_IN_PRODUCTION_USE_OPENSSL_RAND_HEX_64",
        "filmiq_jwt_dev_secret_change_in_production",
    }
    if settings.is_production and settings.jwt_secret in _PLACEHOLDER_JWT_SECRETS:
        raise RuntimeError(
            "JWT_SECRET is still set to a placeholder default. "
            "Set a unique JWT_SECRET env var before running in production."
        )
    await _ensure_default_admin()
    logger.info("Firestore ready")
    yield
    logger.info("FilmIQ shutting down")


app = FastAPI(
    title="FilmIQ API",
    description="Uganda's Cinema Intelligence Platform — Box Office Prediction & Analytics",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs"  if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)


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
app.include_router(data_portal.router, prefix="/api/filmmaker",  tags=["Data Portal"])


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
        "database":    "firestore",
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
