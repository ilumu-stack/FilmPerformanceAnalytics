"""
FilmIQ — Data Submission Portal Router
Lets any authenticated contributor (producer, filmmaker, distributor,
cinema operator, research partner, studio analyst, investor, admin) submit
structured datasets that feed the analytics platform. Replaces the old
movie-management CRUD — submissions carry an arbitrary user-defined schema
(reportTemplates) instead of a fixed movie shape.

Firestore collections: reportTemplates, submissions, submissionVersions,
validationResults, activityLogs.
"""

from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from firebase_db import db
from models import User
from auth_utils import get_current_user, get_current_admin

router = APIRouter()

FieldType = Literal["text", "number", "currency", "date", "boolean", "category"]
CATEGORIES = [
    "box_office", "streaming", "audience_research",
    "marketing", "production", "custom",
]
STATUSES = ["draft", "submitted", "under_review", "approved", "processed", "rejected"]


# ─── Schemas ───────────────────────────────────────────────────────────────

class TemplateField(BaseModel):
    key:      str
    label:    str
    type:     FieldType
    required: bool = False
    options:  Optional[list[str]] = None          # for type=category
    validation: Optional[dict]    = None          # {min,max,regex,dateFormat}


class TemplateCreate(BaseModel):
    name:     str = Field(..., min_length=1, max_length=120)
    category: str = Field(..., pattern="^(" + "|".join(CATEGORIES) + ")$")
    fields:   list[TemplateField] = Field(..., min_length=1)


class SubmissionCreate(BaseModel):
    name:        str = Field(..., min_length=1, max_length=200)
    category:    str = Field(..., pattern="^(" + "|".join(CATEGORIES) + ")$")
    template_id: Optional[str] = None


class VersionUpload(BaseModel):
    rows:    list[dict] = Field(..., min_length=1, max_length=5000)
    mapping: dict[str, str]   # csv column -> template field key


class ReviewAction(BaseModel):
    action: Literal["approve", "reject"]
    reason: Optional[str] = Field(default=None, max_length=500)


# ─── Helpers ───────────────────────────────────────────────────────────────

def _serialize_submission(doc_id: str, data: dict) -> dict:
    return {
        "id":               doc_id,
        "name":             data.get("name", ""),
        "category":         data.get("category", "custom"),
        "template_id":      data.get("template_id"),
        "status":           data.get("status", "draft"),
        "row_count":        data.get("row_count", 0),
        "submitted_by":     data.get("submitted_by"),
        "submitted_by_name": data.get("submitted_by_name"),
        "reviewed_by":      data.get("reviewed_by"),
        "rejection_reason": data.get("rejection_reason"),
        "created_at":       str(data["created_at"]) if data.get("created_at") else None,
        "updated_at":       str(data["updated_at"]) if data.get("updated_at") else None,
    }


def _serialize_template(doc_id: str, data: dict) -> dict:
    return {
        "id":         doc_id,
        "name":       data.get("name", ""),
        "category":   data.get("category", "custom"),
        "fields":     data.get("fields", []),
        "created_by": data.get("created_by"),
        "created_at": str(data["created_at"]) if data.get("created_at") else None,
    }


def _coerce_check(value, field: TemplateField) -> Optional[str]:
    """Returns an error message string if `value` doesn't satisfy `field`, else None."""
    if value in (None, ""):
        return "missing_value" if field.required else None

    rules = field.validation or {}
    if field.type in ("number", "currency"):
        try:
            num = float(value)
        except (TypeError, ValueError):
            return "format_error"
        if "min" in rules and num < rules["min"]:
            return "out_of_range"
        if "max" in rules and num > rules["max"]:
            return "out_of_range"
    elif field.type == "date":
        try:
            datetime.fromisoformat(str(value))
        except ValueError:
            return "invalid_date"
    elif field.type == "boolean":
        if str(value).strip().lower() not in ("true", "false", "1", "0", "yes", "no"):
            return "format_error"
    elif field.type == "category":
        if field.options and value not in field.options:
            return "invalid_category"
    return None


def _validate_rows(rows: list[dict], mapping: dict[str, str], fields: list[TemplateField]) -> dict:
    fields_by_key = {f.key: f for f in fields}
    errors, warnings = [], []
    seen_keys: dict[tuple, list[int]] = {}
    required_keys = [f.key for f in fields if f.required]
    # No template (or no required fields) — fall back to full-row equality for dedupe.
    dedupe_fields = required_keys or list(mapping.values())

    for i, row in enumerate(rows):
        mapped = {field_key: row.get(csv_col) for csv_col, field_key in mapping.items()}
        for field_key, value in mapped.items():
            field = fields_by_key.get(field_key)
            if not field:
                continue
            issue = _coerce_check(value, field)
            if issue == "missing_value":
                warnings.append({"row": i, "field": field_key, "type": issue, "message": f"Missing value for required field '{field.label}'"})
            elif issue:
                errors.append({"row": i, "field": field_key, "type": issue, "message": f"Invalid value for '{field.label}'"})

        dedupe_key = tuple(mapped.get(k) for k in dedupe_fields)
        if any(dedupe_key):
            seen_keys.setdefault(dedupe_key, []).append(i)

    duplicates = [{"rows": idxs, "key": str(k)} for k, idxs in seen_keys.items() if len(idxs) > 1]

    return {
        "errors": errors,
        "warnings": warnings,
        "duplicates": duplicates,
        "summary": {
            "error_count": len(errors),
            "warning_count": len(warnings),
            "duplicate_count": len(duplicates),
        },
    }


async def _log_activity(actor: User, action: str, target_id: str, metadata: Optional[dict] = None):
    await db.collection("activityLogs").document().set({
        "actor_id":   actor.id,
        "actor_name": actor.full_name or actor.username,
        "action":     action,
        "target_id":  target_id,
        "metadata":   metadata or {},
        "created_at": firestore.SERVER_TIMESTAMP,
    })


async def _get_submission_or_404(submission_id: str) -> tuple:
    doc = await db.collection("submissions").document(submission_id).get()
    if not doc.exists:
        raise HTTPException(404, "Submission not found")
    return doc, doc.to_dict() or {}


def _assert_owner_or_admin(current_user: User, data: dict):
    if current_user.role != "admin" and data.get("submitted_by") != current_user.id:
        raise HTTPException(403, "Access denied")


# ─── Templates ─────────────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(current_user: User = Depends(get_current_user)):
    docs = await db.collection("reportTemplates").order_by(
        "created_at", direction=firestore.Query.DESCENDING
    ).get()
    return [_serialize_template(d.id, d.to_dict() or {}) for d in docs]


@router.post("/templates", status_code=201)
async def create_template(body: TemplateCreate, current_user: User = Depends(get_current_user)):
    doc_ref = db.collection("reportTemplates").document()
    await doc_ref.set({
        "name":       body.name,
        "category":   body.category,
        "fields":     [f.model_dump() for f in body.fields],
        "created_by": current_user.id,
        "created_at": firestore.SERVER_TIMESTAMP,
    })
    return {"id": doc_ref.id, "message": "Template created"}


# ─── Stats ─────────────────────────────────────────────────────────────────

@router.get("/stats")
async def submission_stats(current_user: User = Depends(get_current_user)):
    query = db.collection("submissions")
    if current_user.role != "admin":
        query = query.where(filter=FieldFilter("submitted_by", "==", current_user.id))
    docs = await query.get()
    counts = {s: 0 for s in STATUSES}
    for d in docs:
        status = (d.to_dict() or {}).get("status", "draft")
        counts[status] = counts.get(status, 0) + 1
    return {
        "datasets_submitted": sum(counts.values()),
        "pending_review":     counts["submitted"] + counts["under_review"],
        "approved":           counts["approved"],
        "processed":          counts["processed"],
    }


# ─── Submissions ────────────────────────────────────────────────────────────

@router.get("/submissions")
async def list_submissions(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    category:      Optional[str] = None,
    current_user:  User          = Depends(get_current_user),
):
    query = db.collection("submissions")
    if current_user.role != "admin":
        query = query.where(filter=FieldFilter("submitted_by", "==", current_user.id))
    docs = await query.get()

    kept = []
    for d in docs:
        data = d.to_dict() or {}
        if status_filter and data.get("status") != status_filter:
            continue
        if category and data.get("category") != category:
            continue
        kept.append((d.id, data))
    kept.sort(key=lambda pair: pair[1].get("created_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return [_serialize_submission(doc_id, data) for doc_id, data in kept]


@router.post("/submissions", status_code=201)
async def create_submission(body: SubmissionCreate, current_user: User = Depends(get_current_user)):
    doc_ref = db.collection("submissions").document()
    await doc_ref.set({
        "name":              body.name,
        "category":          body.category,
        "template_id":       body.template_id,
        "status":            "draft",
        "row_count":         0,
        "submitted_by":      current_user.id,
        "submitted_by_name": current_user.full_name or current_user.username,
        "reviewed_by":       None,
        "rejection_reason":  None,
        "created_at":        firestore.SERVER_TIMESTAMP,
        "updated_at":        None,
    })
    await _log_activity(current_user, "submission.created", doc_ref.id, {"name": body.name})
    return {"id": doc_ref.id, "message": "Submission created"}


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, current_user: User = Depends(get_current_user)):
    doc, data = await _get_submission_or_404(submission_id)
    _assert_owner_or_admin(current_user, data)

    version_docs = await db.collection("submissionVersions").where(
        filter=FieldFilter("submission_id", "==", submission_id)
    ).get()
    version_docs = sorted(version_docs, key=lambda d: (d.to_dict() or {}).get("version_number", 0), reverse=True)
    latest_version = version_docs[0].to_dict() if version_docs else None

    validation = None
    if latest_version:
        val_docs = await db.collection("validationResults").where(
            filter=FieldFilter("version_id", "==", version_docs[0].id)
        ).limit(1).get()
        if val_docs:
            validation = val_docs[0].to_dict()

    return {
        **_serialize_submission(doc.id, data),
        "latest_version": {
            "rows":    (latest_version or {}).get("rows", []),
            "mapping": (latest_version or {}).get("mapping", {}),
        } if latest_version else None,
        "validation": validation,
    }


@router.post("/submissions/{submission_id}/rows")
async def upload_rows(submission_id: str, body: VersionUpload, current_user: User = Depends(get_current_user)):
    doc, data = await _get_submission_or_404(submission_id)
    _assert_owner_or_admin(current_user, data)
    if data.get("status") not in ("draft", "rejected"):
        raise HTTPException(400, "Only draft or rejected submissions can be re-uploaded")

    fields: list[TemplateField] = []
    if data.get("template_id"):
        tmpl_doc = await db.collection("reportTemplates").document(data["template_id"]).get()
        if tmpl_doc.exists:
            fields = [TemplateField(**f) for f in (tmpl_doc.to_dict() or {}).get("fields", [])]

    existing = await db.collection("submissionVersions").where(
        filter=FieldFilter("submission_id", "==", submission_id)
    ).get()
    version_number = len(existing) + 1

    version_ref = db.collection("submissionVersions").document()
    await version_ref.set({
        "submission_id":  submission_id,
        "version_number": version_number,
        "rows":            body.rows,
        "mapping":         body.mapping,
        "created_by":      current_user.id,
        "created_at":      firestore.SERVER_TIMESTAMP,
    })

    validation = _validate_rows(body.rows, body.mapping, fields)
    await db.collection("validationResults").document().set({
        "submission_id": submission_id,
        "version_id":    version_ref.id,
        **validation,
        "created_at":    firestore.SERVER_TIMESTAMP,
    })

    await doc.reference.update({
        "row_count":  len(body.rows),
        "status":     "draft",
        "updated_at": firestore.SERVER_TIMESTAMP,
    })

    return {"version_id": version_ref.id, "validation": validation}


@router.post("/submissions/{submission_id}/submit")
async def submit_submission(submission_id: str, current_user: User = Depends(get_current_user)):
    doc, data = await _get_submission_or_404(submission_id)
    _assert_owner_or_admin(current_user, data)
    if data.get("status") not in ("draft", "rejected"):
        raise HTTPException(400, "Only draft or rejected submissions can be submitted")
    if not data.get("row_count"):
        raise HTTPException(400, "Upload data before submitting")

    await doc.reference.update({
        "status":           "submitted",
        "rejection_reason": None,
        "updated_at":       firestore.SERVER_TIMESTAMP,
    })
    await _log_activity(current_user, "submission.submitted", submission_id)
    return {"message": "Submission sent for review", "status": "submitted"}


@router.post("/submissions/{submission_id}/start-review")
async def start_review(submission_id: str, current_user: User = Depends(get_current_admin)):
    doc, data = await _get_submission_or_404(submission_id)
    if data.get("status") != "submitted":
        raise HTTPException(400, "Only submitted submissions can enter review")
    await doc.reference.update({"status": "under_review", "updated_at": firestore.SERVER_TIMESTAMP})
    await _log_activity(current_user, "submission.review_started", submission_id)
    return {"message": "Review started", "status": "under_review"}


@router.post("/submissions/{submission_id}/review")
async def review_submission(
    submission_id: str,
    body:          ReviewAction,
    current_user:  User = Depends(get_current_admin),
):
    doc, data = await _get_submission_or_404(submission_id)
    if data.get("status") not in ("submitted", "under_review"):
        raise HTTPException(400, "Submission is not awaiting review")

    if body.action == "approve":
        await doc.reference.update({
            "status":      "processed",
            "reviewed_by": current_user.id,
            "updated_at":  firestore.SERVER_TIMESTAMP,
        })
        await _log_activity(current_user, "submission.approved", submission_id)
        return {"message": "Submission approved and processed", "status": "processed"}

    await doc.reference.update({
        "status":           "rejected",
        "reviewed_by":       current_user.id,
        "rejection_reason":  body.reason,
        "updated_at":        firestore.SERVER_TIMESTAMP,
    })
    await _log_activity(current_user, "submission.rejected", submission_id, {"reason": body.reason})
    return {"message": "Submission rejected", "status": "rejected"}


# ─── Activity ────────────────────────────────────────────────────────────────

@router.get("/activity")
async def my_activity(limit: int = Query(10, le=50), current_user: User = Depends(get_current_user)):
    query = db.collection("activityLogs")
    if current_user.role != "admin":
        query = query.where(filter=FieldFilter("actor_id", "==", current_user.id))
    docs = await query.get()
    rows = [(d, d.to_dict() or {}) for d in docs]
    rows.sort(key=lambda pair: pair[1].get("created_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return [
        {
            "id":         d.id,
            "actor_name": data.get("actor_name"),
            "action":     data.get("action"),
            "target_id":  data.get("target_id"),
            "created_at": str(data["created_at"]) if data.get("created_at") else None,
        }
        for d, data in rows[:limit]
    ]
