"""
FilmIQ — Authentication Router
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password

Self-registration is DISABLED.
New accounts are created by admins via POST /api/admin/users.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from typing import Optional
from collections import defaultdict
from time import monotonic

from database import get_db
from models import User
from auth_utils import get_current_user, hash_password, verify_password, validate_password_complexity
from config import settings

router = APIRouter()


# ── In-memory rate limiter (10 attempts / 15 min per IP) ─────────────────────
_login_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 10
_WINDOW_SECS  = 900  # 15 minutes


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
    email:    EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user:          dict

class UserResponse(BaseModel):
    id:           int
    email:        str
    username:     Optional[str]
    full_name:    Optional[str]
    role:         str
    organisation: Optional[str]
    country:      Optional[str]
    created_at:   str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def complexity(cls, v: str) -> str:
        return validate_password_complexity(v)


# ── Token helpers ─────────────────────────────────────────────────────────────
def _create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = {**data, "exp": datetime.now(timezone.utc) + expires_delta}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def create_access_token(user_id: int, role: str) -> str:
    return _create_token(
        {"sub": str(user_id), "role": role, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )

def create_refresh_token(user_id: int) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )

def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        user={"id": user.id, "email": user.email, "username": user.username, "role": user.role},
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(request.client.host if request.client else "unknown")

    result = await db.execute(select(User).where(User.email == req.email))
    user   = result.scalar_one_or_none()

    # Deliberate vague error — don't reveal which field was wrong
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled. Contact an administrator.")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    credentials_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    try:
        payload = jwt.decode(req.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise credentials_exc
        user_id = int(payload["sub"])
    except (JWTError, ValueError):
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exc

    return _token_response(user)


@router.post("/logout")
async def logout():
    # JWTs are stateless; add token_id to a Redis blocklist for production revocation
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        organisation=current_user.organisation,
        country=current_user.country,
        created_at=str(current_user.created_at),
    )


@router.post("/change-password")
async def change_password(
    body:         ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must differ from current password")

    current_user.hashed_password = hash_password(body.new_password)
    current_user.updated_at      = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Password changed successfully"}
