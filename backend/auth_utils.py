from __future__ import annotations

"""
FilmIQ — Auth Utilities
Provides get_current_user() FastAPI dependency and shared password helpers.
Extracted here to avoid circular imports between routers/auth.py and other routers.
"""

import bcrypt
import re
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt

from database import get_db
from models import User
from config import settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency: decode Bearer JWT → return authenticated User.
    Raises 401 if token is missing, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")

        if user_id is None or token_type != "access":
            raise credentials_exc

    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exc
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact support.",
        )

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ── Password helpers (used by auth router + admin router) ─────────────────────

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def validate_password_complexity(pw: str) -> str:
    """Raise ValueError if pw fails complexity rules; return pw if valid."""
    if not re.search(r"[A-Z]", pw):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", pw):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", pw):
        raise ValueError("Password must contain at least one digit")
    return pw


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    """Returns user_id string if token valid, else None. For semi-public endpoints."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload.get("sub")
    except JWTError:
        return None
