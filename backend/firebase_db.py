"""
FilmIQ — Firebase Admin SDK initialization.

Reads credentials from (in order):
  1. FIREBASE_CREDENTIALS env var  — JSON string of service-account key
  2. FIREBASE_CREDENTIALS_PATH env var — path to service-account key file
  3. Default path  backend/firebase-credentials.json  (next to this file)
  4. Application Default Credentials (gcloud auth / Cloud Run / GCE)

Exports:
  db  — lazy-initialised async Firestore client
        (raises RuntimeError with a friendly message if credentials are missing)
"""

import os
import json
import logging

import firebase_admin
from firebase_admin import credentials

logger = logging.getLogger("filmiq.firebase")

_MISSING_CREDS_MSG = (
    "Firebase credentials not found.\n"
    "Do ONE of the following:\n"
    "  A) Put your service-account JSON at backend/firebase-credentials.json\n"
    "  B) Set FIREBASE_CREDENTIALS=<json string> in your .env\n"
    "  C) Set FIREBASE_CREDENTIALS_PATH=<path> in your .env\n"
    "  D) Run  gcloud auth application-default login  (local dev only)\n"
    "Download the key: Firebase Console → Project Settings → Service Accounts → Generate new private key"
)


def _init_firebase() -> bool:
    """
    Initialise Firebase Admin SDK.
    Returns True on success, False if no credentials could be found.
    """
    if firebase_admin._apps:
        return True

    # 1. Inline JSON (Docker / CI)
    cred_json = os.environ.get("FIREBASE_CREDENTIALS")
    if cred_json:
        try:
            cred = credentials.Certificate(json.loads(cred_json))
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialised from FIREBASE_CREDENTIALS env var")
            return True
        except Exception as exc:
            logger.warning("Could not parse FIREBASE_CREDENTIALS: %s", exc)

    # 2. Path to a service-account JSON file
    cred_path = os.environ.get(
        "FIREBASE_CREDENTIALS_PATH",
        os.path.join(os.path.dirname(__file__), "firebase-credentials.json"),
    )
    if os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialised from credentials file: %s", cred_path)
            return True
        except Exception as exc:
            logger.warning("Could not load credentials from %s: %s", cred_path, exc)

    # 3. Application Default Credentials (Cloud Run / gcloud auth)
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "")
    try:
        opts = {"projectId": project_id} if project_id else None
        firebase_admin.initialize_app(options=opts)
        logger.info(
            "Firebase initialised with Application Default Credentials (project=%s)",
            project_id or "auto-detected",
        )
        return True
    except Exception as exc:
        logger.error("Firebase init failed (no credentials available): %s", exc)
        return False


_firebase_ready = _init_firebase()

# ── Lazy Firestore client ─────────────────────────────────────────────────────

_firestore_client = None


def _get_db():
    """Return the async Firestore client, initialising it on first call."""
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    if not _firebase_ready:
        raise RuntimeError(_MISSING_CREDS_MSG)

    from firebase_admin import firestore_async

    try:
        _firestore_client = firestore_async.client()
        return _firestore_client
    except Exception as exc:
        raise RuntimeError(f"{_MISSING_CREDS_MSG}\n\nUnderlying error: {exc}") from exc


class _LazyFirestore:
    """
    Proxy that forwards all attribute access to the real Firestore client.
    This lets callers do  `from firebase_db import db`  and use `db.collection(...)` etc.
    without triggering the credentials check at import time.
    """

    def __getattr__(self, name):
        return getattr(_get_db(), name)

    def collection(self, *args, **kwargs):
        return _get_db().collection(*args, **kwargs)

    def document(self, *args, **kwargs):
        return _get_db().document(*args, **kwargs)

    def batch(self):
        return _get_db().batch()

    def transaction(self):
        return _get_db().transaction()


# Single module-level object — all routers do  `from firebase_db import db`
db = _LazyFirestore()
