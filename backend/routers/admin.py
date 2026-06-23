"""
FilmIQ — Admin Router (Firestore + Firebase Auth edition)
Requires admin role. All user mutations are mirrored to Firebase Authentication.
"""

import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field, field_validator

from firebase_db import db
from firebase_admin import firestore, auth as firebase_auth
from google.cloud.firestore_v1.base_query import FieldFilter
from models import User, UserRole
from auth_utils import get_current_admin, hash_password, validate_password_complexity
import analytics_service

router = APIRouter()


# ─── Firebase Auth helpers ───────────────────────────────────────────────────

async def _fb_get_uid(email: str) -> Optional[str]:
    """Return Firebase Auth UID for an email, or None if not found."""
    try:
        record = await asyncio.to_thread(firebase_auth.get_user_by_email, email)
        return record.uid
    except firebase_auth.UserNotFoundError:
        return None


async def _fb_create(email: str, password: str, display_name: str, disabled: bool = False) -> None:
    try:
        await asyncio.to_thread(
            firebase_auth.create_user,
            email=email,
            password=password,
            display_name=display_name,
            disabled=disabled,
        )
    except firebase_auth.EmailAlreadyExistsError:
        pass


async def _fb_update_password(email: str, new_password: str) -> None:
    uid = await _fb_get_uid(email)
    if uid:
        await asyncio.to_thread(firebase_auth.update_user, uid, password=new_password)


async def _fb_set_disabled(email: str, disabled: bool) -> None:
    uid = await _fb_get_uid(email)
    if uid:
        await asyncio.to_thread(firebase_auth.update_user, uid, disabled=disabled)


async def _fb_delete(email: str) -> None:
    uid = await _fb_get_uid(email)
    if uid:
        await asyncio.to_thread(firebase_auth.delete_user, uid)


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

class EditUserRequest(BaseModel):
    full_name:    Optional[str] = Field(default=None, max_length=200)
    username:     Optional[str] = Field(default=None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    organisation: Optional[str] = None
    country:      Optional[str] = None

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def complexity(cls, v: str) -> str:
        return validate_password_complexity(v)


# ─── User Management ────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    page:   int = 1,
    limit:  int = 50,
    _admin: User = Depends(get_current_admin),
):
    all_docs = await db.collection("users").order_by("created_at").get()
    total    = len(all_docs)
    offset   = (page - 1) * limit
    page_docs = all_docs[offset : offset + limit]

    users = []
    for doc in page_docs:
        u = User.from_firestore(doc)
        users.append({
            "id":                   u.id,
            "email":                u.email,
            "username":             u.username,
            "full_name":            u.full_name,
            "role":                 u.role,
            "country":              u.country,
            "organisation":         u.organisation,
            "is_active":            u.is_active,
            "must_change_password": bool(u.must_change_password),
            "created_at":           str(u.created_at) if u.created_at else None,
            "last_login":           str(u.last_login)  if u.last_login  else None,
        })

    return {
        "users": users,
        "total": total,
        "page":  page,
        "pages": (total + limit - 1) // limit if total else 0,
    }


@router.put("/users/{user_id}")
async def edit_user(
    user_id: str,
    body:    EditUserRequest,
    _admin:  User = Depends(get_current_admin),
):
    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No changes", "user_id": user_id}

    if "username" in updates:
        existing = await db.collection("users").where(
            filter=FieldFilter("username", "==", updates["username"])
        ).limit(1).get()
        if existing and existing[0].id != user_id:
            raise HTTPException(400, "Username already taken")

    updates["updated_at"] = firestore.SERVER_TIMESTAMP
    await db.collection("users").document(user_id).update(updates)
    return {"message": "User updated", "user_id": user_id}


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    body:    UserRoleUpdate,
    _admin:  User = Depends(get_current_admin),
):
    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    await db.collection("users").document(user_id).update({"role": body.role.value})
    return {"message": f"Role updated to {body.role.value}", "user_id": user_id}


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    body:    UserStatusUpdate,
    _admin:  User = Depends(get_current_admin),
):
    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")

    email = (doc.to_dict() or {}).get("email", "")
    # Mirror to Firebase Auth (disabled = not active)
    await _fb_set_disabled(email, disabled=not body.is_active)
    await db.collection("users").document(user_id).update({"is_active": body.is_active})
    return {"message": f"User {'activated' if body.is_active else 'deactivated'}", "user_id": user_id}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin:   User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot delete your own account")
    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")

    email = (doc.to_dict() or {}).get("email", "")
    await _fb_delete(email)
    await db.collection("users").document(user_id).delete()
    return {"message": "User deleted"}


@router.post("/users", status_code=201)
async def create_user(
    body:   CreateUserRequest,
    _admin: User = Depends(get_current_admin),
):
    email_str = str(body.email)

    # Uniqueness checks
    email_docs    = await db.collection("users").where(filter=FieldFilter("email",    "==", email_str)).limit(1).get()
    username_docs = await db.collection("users").where(filter=FieldFilter("username", "==", body.username)).limit(1).get()
    if email_docs:
        raise HTTPException(400, "Email already in use")
    if username_docs:
        raise HTTPException(400, "Username already taken")

    # Create in Firebase Authentication first
    await _fb_create(
        email=email_str,
        password=body.password,
        display_name=body.full_name or body.username,
    )

    # Create in Firestore
    doc_ref = db.collection("users").document()
    await doc_ref.set({
        "email":                email_str,
        "username":             body.username,
        "hashed_password":      hash_password(body.password),
        "full_name":            body.full_name,
        "role":                 body.role.value,
        "organisation":         body.organisation,
        "country":              body.country,
        "is_active":            True,
        "must_change_password": True,
        "created_at":           firestore.SERVER_TIMESTAMP,
        "updated_at":           None,
        "last_login":           None,
    })

    return {
        "id":        doc_ref.id,
        "email":     email_str,
        "username":  body.username,
        "role":      body.role.value,
        "is_active": True,
        "message":   "User created successfully",
    }


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    body:    ResetPasswordRequest,
    _admin:  User = Depends(get_current_admin),
):
    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")

    data  = doc.to_dict() or {}
    email = data.get("email", "")

    # Update Firebase Auth password
    await _fb_update_password(email, body.new_password)

    # Update Firestore
    await db.collection("users").document(user_id).update({
        "hashed_password":      hash_password(body.new_password),
        "must_change_password": True,
        "updated_at":           firestore.SERVER_TIMESTAMP,
    })
    return {"message": f"Password reset for {email}"}


# ─── System Stats ────────────────────────────────────────────────────────────
@router.get("/stats")
async def system_stats(_admin: User = Depends(get_current_admin)):
    user_docs  = await db.collection("users").get()
    pred_docs  = await db.collection("predictions").get()

    ml_path = os.environ.get("ML_MODEL_PATH", "ml/saved_models")
    models_loaded = []
    for name in ["random_forest", "xgboost", "neural_net", "scaler"]:
        path = os.path.join(ml_path, f"{name}.pkl")
        models_loaded.append({"name": name, "loaded": os.path.exists(path)})

    training_results = analytics_service.model_accuracy()

    return {
        "database": {
            "type":        "firestore",
            "users":       len(user_docs),
            "predictions": len(pred_docs),
        },
        "ml_models":        models_loaded,
        "training_results": training_results,
        "environment":      os.environ.get("ENVIRONMENT", "development"),
    }


# ─── ETL Controls ────────────────────────────────────────────────────────────
@router.get("/etl/status")
async def etl_status(_admin: User = Depends(get_current_admin)):
    return {
        "status":            "idle",
        "last_run":          None,
        "next_run":          None,
        "records_processed": 0,
        "available_sources": ["tmdb_csv", "manual_upload"],
    }


@router.post("/etl/run")
async def trigger_etl(
    background_tasks: BackgroundTasks,
    source: str = "tmdb_csv",
    _admin: User = Depends(get_current_admin),
):
    background_tasks.add_task(_run_etl, source)
    return {"message": f"ETL job '{source}' started", "status": "running"}


async def _run_etl(source: str):
    await asyncio.sleep(1)
    print(f"ETL '{source}' completed (placeholder)")


# ─── Cache ───────────────────────────────────────────────────────────────────
@router.delete("/cache")
async def flush_cache(_admin: User = Depends(get_current_admin)):
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
async def list_reports(_admin: User = Depends(get_current_admin)):
    docs = await db.collection("reports").order_by("created_at").limit(50).get()
    return [
        {
            "id":          doc.id,
            "title":       doc.to_dict().get("title"),
            "report_type": doc.to_dict().get("report_type"),
            "user_id":     doc.to_dict().get("user_id"),
            "created_at":  str(doc.to_dict().get("created_at")),
        }
        for doc in docs
    ]
