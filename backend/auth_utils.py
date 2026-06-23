from __future__ import annotations

"""
FilmIQ — Auth Utilities (Firestore edition)
Provides get_current_user() FastAPI dependency and shared password helpers.
"""

import bcrypt
import re
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from firebase_db import db
from models import User
from config import settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """
    FastAPI dependency: decode Bearer JWT → return authenticated User from Firestore.
    Raises 401 if token is missing, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")

        if user_id is None or token_type != "access":
            raise credentials_exc

    except JWTError:
        raise credentials_exc

    doc = await db.collection("users").document(user_id).get()
    if not doc.exists:
        raise credentials_exc

    user = User.from_firestore(doc)

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


async def get_current_filmmaker(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: require filmmaker or admin role."""
    if current_user.role not in ("filmmaker", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Filmmaker access required",
        )
    return current_user


async def get_current_investor(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: require investor or admin role."""
    if current_user.role not in ("investor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Investor access required",
        )
    return current_user


# ── Password helpers ──────────────────────────────────────────────────────────

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
