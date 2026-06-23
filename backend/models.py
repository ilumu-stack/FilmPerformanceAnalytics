"""
FilmIQ — Domain models (Firestore edition).

Plain Python dataclasses — no SQLAlchemy ORM.
Documents are stored in Firestore collections; these classes wrap the raw dicts.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any


# ──────────────────────────────────────────────
# ENUMS
# ──────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin            = "admin"
    analyst          = "analyst"
    investor         = "investor"
    filmmaker        = "filmmaker"
    producer         = "producer"
    distributor      = "distributor"
    cinema_operator  = "cinema_operator"
    research_partner = "research_partner"
    studio_analyst    = "studio_analyst"


class SentimentLabel(str, enum.Enum):
    positive = "positive"
    neutral  = "neutral"
    negative = "negative"


class PredictionStatus(str, enum.Enum):
    pending   = "pending"
    completed = "completed"
    failed    = "failed"


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def _ts(value: Any) -> Optional[str]:
    """Convert a Firestore timestamp / datetime to ISO string (or None)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


# ──────────────────────────────────────────────
# USER
# ──────────────────────────────────────────────

@dataclass
class User:
    id:                   str           # Firestore document ID
    email:                str
    username:             Optional[str]
    hashed_password:      str
    full_name:            Optional[str]
    role:                 str
    organisation:         Optional[str]
    country:              Optional[str]
    is_active:            bool
    must_change_password: bool
    created_at:           Optional[Any] = None
    updated_at:           Optional[Any] = None
    last_login:           Optional[Any] = None

    # ── Firestore ↔ dataclass conversion ─────────────────────────────────────

    @staticmethod
    def from_firestore(doc) -> "User":
        data: dict = doc.to_dict() or {}
        return User(
            id                   = doc.id,
            email                = data.get("email", ""),
            username             = data.get("username"),
            hashed_password      = data.get("hashed_password", ""),
            full_name            = data.get("full_name"),
            role                 = data.get("role", UserRole.analyst.value),
            organisation         = data.get("organisation"),
            country              = data.get("country", "Uganda"),
            is_active            = data.get("is_active", True),
            must_change_password = data.get("must_change_password", False),
            created_at           = data.get("created_at"),
            updated_at           = data.get("updated_at"),
            last_login           = data.get("last_login"),
        )

    def to_response_dict(self) -> dict:
        return {
            "id":                   self.id,
            "email":                self.email,
            "username":             self.username,
            "full_name":            self.full_name,
            "role":                 self.role,
            "organisation":         self.organisation,
            "country":              self.country,
            "is_active":            self.is_active,
            "must_change_password": bool(self.must_change_password),
            "created_at":           _ts(self.created_at),
            "last_login":           _ts(self.last_login),
        }
