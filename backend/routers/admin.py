"""
FilmIQ — Admin Router
Requires admin role. Manages users, ETL, cache, and system controls.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime, timezone
import os, json

from database import get_db
from models import User, Movie, Prediction, UserRole
from auth_utils import get_current_admin, hash_password, validate_password_complexity

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────
class UserRoleUpdate(BaseModel):
    role: UserRole

class UserStatusUpdate(BaseModel):
    is_active: bool

class CreateUserRequest(BaseModel):
    email:        EmailStr
    username:     str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password:     str = Field(..., min_length=8, max_length=128)
    full_name:    Optional[str] = Field(default=None, max_length=200)
    role:         UserRole = UserRole.analyst
    organisation: Optional[str] = None
    country:      str = "Uganda"

    @field_validator("password")
    @classmethod
    def complexity(cls, v: str) -> str:
        return validate_password_complexity(v)

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def complexity(cls, v: str) -> str:
        return validate_password_complexity(v)


# ─── User Management ────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    page:  int = 1,
    limit: int = 50,
    db:    AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
    )
    users = result.scalars().all()
    total = await db.scalar(select(func.count(User.id)))
    return {
        "users": [
            {
                "id":           u.id,
                "email":        u.email,
                "username":     u.username,
                "full_name":    u.full_name,
                "role":         u.role,
                "country":      u.country,
                "organisation": u.organisation,
                "is_active":    u.is_active,
                "created_at":   str(u.created_at),
                "last_login":   str(u.last_login) if u.last_login else None,
            }
            for u in users
        ],
        "total": total,
        "page":  page,
        "pages": (total + limit - 1) // limit if total else 0,
    }


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    body:    UserRoleUpdate,
    db:      AsyncSession = Depends(get_db),
    _admin:  User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.role = body.role.value  # String column requires .value not enum object
    await db.commit()
    return {"message": f"Role updated to {body.role.value}", "user_id": user_id}


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    body:    UserStatusUpdate,
    db:      AsyncSession = Depends(get_db),
    _admin:  User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = body.is_active
    await db.commit()
    return {"message": f"User {'activated' if body.is_active else 'deactivated'}", "user_id": user_id}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db:      AsyncSession = Depends(get_db),
    admin:   User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}


@router.post("/users", status_code=201)
async def create_user(
    body:   CreateUserRequest,
    db:     AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    if await db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(400, "Email already in use")
    if await db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(400, "Username already taken")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role.value,
        organisation=body.organisation,
        country=body.country,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {
        "id":        user.id,
        "email":     user.email,
        "username":  user.username,
        "role":      user.role,
        "is_active": user.is_active,
        "message":   "User created successfully",
    }


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    body:    ResetPasswordRequest,
    db:      AsyncSession = Depends(get_db),
    _admin:  User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.hashed_password = hash_password(body.new_password)
    user.updated_at      = datetime.now(timezone.utc)
    await db.commit()
    return {"message": f"Password reset for {user.email}"}


# ─── System Stats ────────────────────────────────────────────────────────────
@router.get("/stats")
async def system_stats(
    db:     AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    users_count  = await db.scalar(select(func.count(User.id)))
    movies_count = await db.scalar(select(func.count(Movie.id)))
    preds_count  = await db.scalar(select(func.count(Prediction.id)))

    # ML models status
    ml_path = os.environ.get("ML_MODEL_PATH", "ml/saved_models")
    models_loaded = []
    for name in ["random_forest", "xgboost", "neural_net", "scaler"]:
        path = os.path.join(ml_path, f"{name}.pkl")
        models_loaded.append({"name": name, "loaded": os.path.exists(path)})

    # Training results if available
    training_results = None
    results_path = os.path.join(os.path.dirname(__file__), "../../ml/training_results.json")
    try:
        with open(results_path) as f:
            training_results = json.load(f)
    except Exception:
        pass

    return {
        "database": {
            "users":       users_count or 0,
            "movies":      movies_count or 0,
            "predictions": preds_count or 0,
        },
        "ml_models":       models_loaded,
        "training_results": training_results,
        "environment":     os.environ.get("ENVIRONMENT", "development"),
    }


# ─── ETL Controls ────────────────────────────────────────────────────────────
@router.get("/etl/status")
async def etl_status(_admin: User = Depends(get_current_admin)):
    """Report on data pipeline state."""
    return {
        "status":       "idle",
        "last_run":     None,
        "next_run":     None,
        "records_processed": 0,
        "available_sources": ["tmdb_csv", "manual_upload"],
    }


@router.post("/etl/run")
async def trigger_etl(
    background_tasks: BackgroundTasks,
    source: str = "tmdb_csv",
    _admin: User = Depends(get_current_admin),
):
    """Trigger a background ETL job."""
    background_tasks.add_task(_run_etl, source)
    return {"message": f"ETL job '{source}' started", "status": "running"}


async def _run_etl(source: str):
    """Placeholder ETL runner — extend with real pipeline logic."""
    import asyncio
    await asyncio.sleep(1)
    print(f"ETL '{source}' completed (placeholder)")


# ─── Cache ───────────────────────────────────────────────────────────────────
@router.delete("/cache")
async def flush_cache(_admin: User = Depends(get_current_admin)):
    """Flush Redis analytics cache."""
    try:
        import redis.asyncio as aioredis
        from config import settings
        r = aioredis.from_url(settings.redis_url)
        await r.flushdb()
        await r.aclose()
        return {"message": "Cache flushed"}
    except Exception as e:
        return {"message": f"Cache flush skipped (Redis unavailable): {e}"}


# ─── Reports ─────────────────────────────────────────────────────────────────
@router.get("/reports")
async def list_reports(
    db:     AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    from models import Report
    result = await db.execute(
        select(Report).order_by(Report.created_at.desc()).limit(50)
    )
    reports = result.scalars().all()
    return [
        {
            "id":          r.id,
            "title":       r.title,
            "report_type": r.report_type,
            "user_id":     r.user_id,
            "created_at":  str(r.created_at),
        }
        for r in reports
    ]
