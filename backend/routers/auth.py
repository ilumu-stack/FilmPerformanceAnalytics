"""
FilmIQ — Authentication Router (Firestore edition)
POST /api/auth/login          — email OR username + password
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password

Self-registration is DISABLED.
New accounts are created by admins via POST /api/admin/users.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from typing import Optional
from collections import defaultdict
from time import monotonic

import asyncio
from firebase_db import db
from firebase_admin import firestore, auth as firebase_auth
from google.cloud.firestore_v1.base_query import FieldFilter
from models import User
from auth_utils import get_current_user, hash_password, verify_password, validate_password_complexity
from config import settings

router = APIRouter()


# ── In-memory rate limiter (10 attempts / 15 min per IP) ─────────────────────
_login_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 10
_WINDOW_SECS  = 900


def _check_rate_limit(ip: str) -> None:
    cutoff = monotonic() - _WINDOW_SECS
    recent = [t for t in _login_attempts[ip] if t > cutoff]
    if len(recent) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many login attempts. Try again in 15 minutes.",
        )
    recent.append(monotonic())
    _login_attempts[ip] = recent


# ── Schemas ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email address or username")
    password:   str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token:         str
    refresh_token:        str
    token_type:           str  = "bearer"
    user:                 dict
    must_change_password: bool = False

class UserResponse(BaseModel):
    id:                   str
    email:                str
    username:             Optional[str]
    full_name:            Optional[str]
    role:                 str
    organisation:         Optional[str]
    country:              Optional[str]
    created_at:           Optional[str]
    must_change_password: bool = False

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def complexity(cls, v: str) -> str:
        return validate_password_complexity(v)

class ChangePasswordResponse(BaseModel):
    message:       str
    access_token:  str
    refresh_token: str


# ── Token helpers ─────────────────────────────────────────────────────────────
def _create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = {**data, "exp": datetime.now(timezone.utc) + expires_delta}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def create_access_token(user_id: str, role: str, must_change_pw: bool = False) -> str:
    return _create_token(
        {"sub": user_id, "role": role, "type": "access", "must_change_pw": must_change_pw},
        timedelta(minutes=settings.access_token_expire_minutes),
    )

def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )

def _token_response(user: User) -> TokenResponse:
    mcp = bool(user.must_change_password)
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, mcp),
        refresh_token=create_refresh_token(user.id),
        user={"id": user.id, "email": user.email, "username": user.username, "role": user.role},
        must_change_password=mcp,
    )


# ── Firestore helpers ─────────────────────────────────────────────────────────
async def _find_user_by_identifier(identifier: str) -> Optional[User]:
    """Find user by email or username."""
    docs = await db.collection("users").where(filter=FieldFilter("email", "==", identifier)).limit(1).get()
    if docs:
        return User.from_firestore(docs[0])
    docs = await db.collection("users").where(filter=FieldFilter("username", "==", identifier)).limit(1).get()
    if docs:
        return User.from_firestore(docs[0])
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(request: Request, req: LoginRequest):
    _check_rate_limit(request.client.host if request.client else "unknown")

    user = await _find_user_by_identifier(req.identifier)

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled. Contact an administrator.")

    await db.collection("users").document(user.id).update(
        {"last_login": firestore.SERVER_TIMESTAMP}
    )
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest):
    credentials_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    try:
        payload = jwt.decode(req.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise credentials_exc
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise credentials_exc

    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise credentials_exc

    user = User.from_firestore(doc)
    if not user.is_active:
        raise credentials_exc

    return _token_response(user)


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    from models import _ts
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        organisation=current_user.organisation,
        country=current_user.country,
        created_at=_ts(current_user.created_at),
        must_change_password=bool(current_user.must_change_password),
    )


@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    body:         ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must differ from current password")

    # Update Firebase Auth password
    try:
        fb_user = await asyncio.to_thread(firebase_auth.get_user_by_email, current_user.email)
        await asyncio.to_thread(firebase_auth.update_user, fb_user.uid, password=body.new_password)
    except Exception:
        pass  # Non-fatal: backend JWT is still authoritative

    # Update Firestore
    await db.collection("users").document(current_user.id).update({
        "hashed_password":      hash_password(body.new_password),
        "must_change_password": False,
        "updated_at":           firestore.SERVER_TIMESTAMP,
    })

    # Fetch updated user to issue a fresh token with must_change_pw=False
    doc = await db.collection("users").document(current_user.id).get()
    updated_user = User.from_firestore(doc)
    tokens = _token_response(updated_user)

    return ChangePasswordResponse(
        message="Password changed successfully",
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
    )
