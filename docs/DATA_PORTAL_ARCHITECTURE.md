# FilmIQ Data Submission Portal — Architecture & Migration Plan

Replaces `/filmmaker` (Movie Management) with a general-purpose, schema-agnostic
data ingestion portal. Grounded in the current stack: Next.js App Router
frontend, FastAPI + Firestore backend (`backend/firebase_db.py`), hybrid
Firebase/JWT auth (`useAuthStore`), existing role set `admin | analyst |
investor | filmmaker` (`backend/models.py:UserRole`).

---

## 1. Concept

| | Before | After |
|---|---|---|
| Route | `/filmmaker` | `/filmmaker` (kept — see §7) renamed in-page to **Data Portal** |
| Unit of work | a Movie record | a **Submission** (one uploaded dataset + its lifecycle) |
| Schema | fixed (title/genre/director/budget…) | user-defined per **Report Template** |
| Roles | filmmaker, admin | filmmaker, producer, distributor, cinema_operator, research_partner, studio_analyst, investor, admin |
| Storage | Firestore `movies` docs only | Firebase Storage (raw CSV) + Firestore (metadata, schema, validation, processed rows) |

New roles are additive to `UserRole` — see §8 migration step 1.

---

## 2. Firestore Data Model

All collections live alongside existing `users` / `predictions`. Top-level
`organizations` is new and lets multiple studios/distributors share the
platform without seeing each other's submissions.

### `organizations/{orgId}`
```json
{
  "name": "Kino Studios",
  "industry": "film",
  "plan": "standard",
  "createdAt": "2026-06-24T10:00:00Z",
  "memberIds": ["uid_1", "uid_2"]
}
```

### `users/{uid}` (extended)
```json
{
  "username": "j.doe",
  "role": "producer",
  "orgId": "org_abc123",
  "...": "existing fields unchanged"
}
```

### `reportTemplates/{templateId}`
Defines the dynamic schema a category of upload must conform to. Created by
admins/studio_analysts, reused across submissions.
```json
{
  "name": "Box Office Weekly",
  "category": "box_office",
  "orgId": "org_abc123",
  "createdBy": "uid_1",
  "fields": [
    { "key": "title",    "label": "Title",    "type": "text",     "required": true },
    { "key": "revenue",  "label": "Revenue",  "type": "currency",  "required": true,
      "validation": { "min": 0 } },
    { "key": "weekend",  "label": "Weekend Of","type": "date",      "required": true },
    { "key": "screens",  "label": "Screens",  "type": "number",    "required": false },
    { "key": "is_wide_release", "label": "Wide Release", "type": "boolean", "required": false },
    { "key": "territory","label": "Territory","type": "category",  "required": false,
      "options": ["domestic", "international"] }
  ],
  "version": 3,
  "createdAt": "2026-04-01T00:00:00Z"
}
```
Field `type` ∈ `text | number | currency | date | boolean | category`.

### `submissions/{submissionId}`
The primary tracked entity in the dashboard.
```json
{
  "orgId": "org_abc123",
  "submittedBy": "uid_2",
  "templateId": "tmpl_box_office",
  "category": "box_office",
  "name": "Q2 2026 Box Office — Kino",
  "status": "under_review",
  "currentVersionId": "ver_3",
  "rowCount": 1284,
  "fileRef": "gs://filmiq-uploads/org_abc123/sub_xyz/raw.csv",
  "createdAt": "2026-06-20T09:00:00Z",
  "updatedAt": "2026-06-22T14:10:00Z",
  "reviewedBy": null,
  "rejectionReason": null
}
```
`status` ∈ `draft | submitted | under_review | approved | processed | rejected`.

### `submissionVersions/{versionId}`
Every re-upload/re-map of a submission creates a new immutable version
(audit trail + rollback).
```json
{
  "submissionId": "sub_xyz",
  "versionNumber": 3,
  "fileRef": "gs://filmiq-uploads/org_abc123/sub_xyz/v3.csv",
  "fieldMappingId": "map_42",
  "createdBy": "uid_2",
  "createdAt": "2026-06-22T14:10:00Z"
}
```

### `fieldMappings/{mappingId}`
The CSV-column → template-field mapping chosen in the wizard.
```json
{
  "submissionId": "sub_xyz",
  "templateId": "tmpl_box_office",
  "mapping": {
    "movie_name": "title",
    "opening_weekend": "revenue",
    "wknd_date": "weekend"
  },
  "unmappedColumns": ["notes"],
  "createdAt": "2026-06-22T14:05:00Z"
}
```

### `datasets/{datasetId}`
Holds the **processed** rows after transformation — this is what the
Analytics Engine reads. Raw rows never land here directly (§4).
```json
{
  "submissionId": "sub_xyz",
  "templateId": "tmpl_box_office",
  "orgId": "org_abc123",
  "rowCount": 1280,
  "schemaVersion": 3,
  "processedAt": "2026-06-22T14:20:00Z",
  "storageRef": "gs://filmiq-processed/org_abc123/sub_xyz/dataset.parquet"
}
```
Large processed payloads go to Storage (Parquet/JSON), not inline Firestore
documents — Firestore holds the pointer + summary stats only, avoiding the
1 MiB document limit.

### `validationResults/{validationId}`
```json
{
  "submissionId": "sub_xyz",
  "versionId": "ver_3",
  "errors": [
    { "row": 12, "field": "revenue", "type": "format_error", "message": "Not a number" }
  ],
  "warnings": [
    { "row": 45, "field": "weekend", "type": "missing_value", "message": "Empty date" }
  ],
  "duplicates": [{ "rows": [3, 88], "key": "title+weekend" }],
  "summary": { "errorCount": 1, "warningCount": 1, "duplicateCount": 1 },
  "createdAt": "2026-06-22T14:08:00Z"
}
```

### `processingJobs/{jobId}`
Tracks async Cloud Function work so the UI can poll/subscribe to progress.
```json
{
  "submissionId": "sub_xyz",
  "type": "validate" ,
  "status": "running",
  "startedAt": "2026-06-22T14:08:00Z",
  "finishedAt": null,
  "error": null
}
```
`type` ∈ `validate | transform | analytics_sync`. `status` ∈ `queued | running | succeeded | failed`.

### `activityLogs/{logId}`
```json
{
  "orgId": "org_abc123",
  "actorId": "uid_2",
  "action": "submission.approved",
  "targetId": "sub_xyz",
  "metadata": { "rowCount": 1280 },
  "createdAt": "2026-06-22T14:25:00Z"
}
```

**Indexes needed:** `submissions` composite on `(orgId, status, createdAt desc)` and `(submittedBy, createdAt desc)`; `activityLogs` on `(orgId, createdAt desc)`.

---

## 3. CSV Upload Workflow (Wizard)

```
New Submission
 ├─ Step 1: Choose category → lists active reportTemplates for org
 │           (+ "Custom Dataset" → inline schema builder, §5)
 ├─ Step 2: Upload CSV → client-side parse (header + first 50 rows) for preview
 │           file → Firebase Storage, signed path returned to client
 ├─ Step 3: Preview rows → CSVPreview table, raw values, no mapping yet
 ├─ Step 4: Map columns → ColumnMapper: CSV header ↔ template field
 │           e.g. movie_name → Title, opening_weekend → Revenue
 │           unmapped columns flagged, required fields must be mapped to enable Next
 ├─ Step 5: Validation → calls validation Cloud Function, shows
 │           ValidationPanel (errors block submit, warnings don't)
 └─ Step 6: Submit → status: draft → submitted, processingJobs row created
```

Status progression after submit is server-driven, not user-driven:
`submitted → under_review` (admin queue) `→ approved → processed` or `→ rejected`.

---

## 4. Analytics Pipeline

Raw uploads never write straight into analytics collections — they pass
through validation and transformation first, so a bad CSV can't corrupt
downstream dashboards.

```
┌────────────────┐   ┌───────────────────┐   ┌──────────────────────┐
│  CSV Upload    │──▶│  Raw Dataset       │──▶│  Validation Engine   │
│  (Storage)     │   │  Collection        │   │  (Cloud Function,    │
└────────────────┘   │  (submissionVersions+ │  triggered on upload) │
                      │   fieldMappings)   │   └──────────┬───────────┘
                      └────────────────────┘              │
                                                ┌──────────▼───────────┐
                                                │  validationResults    │
                                                │  errors/warnings      │
                                                └──────────┬───────────┘
                                       errors==0 (or admin override)
                                                ┌──────────▼───────────┐
                                                │  Transformation Layer │
                                                │  (Cloud Function):    │
                                                │  apply fieldMapping,  │
                                                │  coerce types,        │
                                                │  dedupe, normalize    │
                                                └──────────┬───────────┘
                                                ┌──────────▼───────────┐
                                                │  Processed Dataset    │
                                                │  Collection           │
                                                │  (`datasets/{id}`)    │
                                                └──────────┬───────────┘
                                                ┌──────────▼───────────┐
                                                │  Analytics Engine     │
                                                │  (existing /analytics │
                                                │  pages read from here)│
                                                └───────────────────────┘
```

Admin approval (`submissions.status: approved`) gates the Transformation
Layer — nothing reaches `datasets/` without sign-off, even if validation
passed cleanly.

---

## 5. Dynamic Schema System

`reportTemplates.fields[]` (§2) is the schema. The **Custom Dataset** path
in Step 1 lets a user build one inline before uploading:

```
SchemaBuilder
 ├─ Add Field → { label, type, required, validation }
 ├─ type=category → options[] editor appears
 ├─ type=number|currency → min/max editor appears
 ├─ type=date → format picker (ISO, US, EU)
 └─ Save as Template → writes reportTemplates doc (orgId-scoped),
                        immediately available in Step 1 for next time
```
Validation rules stored per-field (`validation: { min, max, regex, dateFormat }`)
are interpreted by the same Validation Engine Cloud Function used for
predefined templates — one rules engine, not two.

---

## 6. Dashboard Layout (Wireframes)

```
┌─────────────────────────────────────────────────────────────────┐
│ Data Portal                                    [ + New Submission ]│
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │Datasets  │ │Pending   │ │Approved  │ │Processed │              │
│ │Submitted │ │Review    │ │          │ │          │              │
│ │   42     │ │   5      │ │   30     │ │   28     │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
├─────────────────────────────────────────────────────────────────┤
│ Recent Submissions                                  [ View all ] │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Name              Category    Status        Rows   Date   │   │
│ │ Q2 Box Office      Box Office  Under Review  1284  Jun 22 │   │
│ │ Streaming Apr      Streaming   Approved        940  Jun 18 │   │
│ │ Survey Wave 3       Audience    Processed       210  Jun 10 │   │
│ └───────────────────────────────────────────────────────────┘   │
├───────────────────────────────┬───────────────────────────────────┤
│ Validation Issues             │ My Activity                       │
│ ⚠ 3 warnings · ⛔ 1 error      │ • Uploaded "Q2 Box Office" (2d ago)│
│ Q2 Box Office — row 12        │ • Approved "Streaming Apr" (4d ago)│
└───────────────────────────────┴───────────────────────────────────┘
```

Wizard (full-screen modal / route `/filmmaker/submit/[step]`):
```
Step 1            Step 2          Step 3          Step 4           Step 5            Step 6
Category    ──▶   Upload CSV ──▶  Preview   ──▶   Map Columns ──▶  Validate    ──▶   Review & Submit
[●][○][○][○][○][○]
```

---

## 7. React Architecture

```
frontend/app/filmmaker/
├── page.tsx                          → DataPortalPage (was Movie Management)
├── submit/
│   ├── page.tsx                      → redirects to /submit/category
│   └── [step]/page.tsx               → UploadWizard step router
├── submissions/[id]/page.tsx         → SubmissionDetail (DatasetViewer + status)
└── templates/page.tsx                → admin/analyst: manage reportTemplates

frontend/components/data-portal/
├── SubmissionDashboard.tsx           → stat cards + grid layout shell
├── SubmissionTable.tsx               → Recent Submissions table (reuses table
│                                        styles from old movies table)
├── ActivityFeed.tsx                  → My Activity panel
├── ValidationPanel.tsx               → errors/warnings list, used in dashboard
│                                        AND inside the wizard
├── SubmissionStatusTracker.tsx       → status pill + progression stepper
├── DatasetViewer.tsx                 → processed dataset preview (post-approval)
└── wizard/
    ├── UploadWizard.tsx              → step state machine, owns submissions doc
    ├── CategoryStep.tsx              → Step 1
    ├── CSVUploadStep.tsx             → Step 2 (Storage upload)
    ├── CSVPreview.tsx                → Step 3
    ├── ColumnMapper.tsx              → Step 4
    ├── ValidationStep.tsx            → Step 5 (wraps ValidationPanel)
    ├── ReviewStep.tsx                → Step 6
    └── SchemaBuilder.tsx             → Custom Dataset inline schema editor
```

`lib/api.ts` gains a `dataPortalApi` namespace (`listSubmissions`,
`createSubmission`, `uploadCsv`, `getUploadUrl`, `mapColumns`, `validate`,
`submit`, `approve/reject`, `listTemplates`, `createTemplate`) replacing
`filmmakersApi`'s movie CRUD calls. `FilmmakerMovie` type retired in favor of
`Submission`, `ReportTemplate`, `ValidationResult`.

---

## 8. Firebase Architecture

- **Firestore** — all metadata: `submissions`, `submissionVersions`,
  `fieldMappings`, `reportTemplates`, `validationResults`, `processingJobs`,
  `activityLogs`, `datasets` (pointer + summary only).
- **Firebase Storage** — actual file bytes:
  - `gs://filmiq-uploads/{orgId}/{submissionId}/v{n}.csv` — raw uploads,
    written directly from the frontend via a signed upload URL issued by the
    backend (keeps service-account credentials server-side).
  - `gs://filmiq-processed/{orgId}/{submissionId}/dataset.parquet` — written
    by the Transformation Cloud Function, never by the client.
- **Cloud Functions** (Storage-triggered + callable):
  - `onCsvUploaded` (Storage trigger on `filmiq-uploads/**`) → creates
    `processingJobs` row, runs the Validation Engine, writes
    `validationResults`, flips `submissions.status` `draft → submitted`
    is explicit (user action), but validation itself runs automatically post-upload.
  - `transformSubmission` (callable, invoked on admin approval) → reads
    `fieldMappings` + raw CSV, applies `reportTemplates` schema, dedupes,
    writes `datasets/{id}` + Parquet to `filmiq-processed`, flips status
    `approved → processed`.
  - `syncAnalytics` (Firestore trigger on `datasets` create) → denormalizes
    into whatever the existing `/analytics` pages already read, isolating
    legacy analytics code from the new pipeline's internals.
- **Processing trigger:** upload → Storage object finalize event → Cloud
  Function, not a client-polled job — the wizard listens to the
  `processingJobs` doc via Firestore `onSnapshot` for live progress.
- **Status updates:** every transition is written by backend/Cloud Function
  code only (never directly by the client) and logged to `activityLogs`,
  matching the existing pattern where `backend/routers/*.py` is the sole
  writer of state-changing fields.

---

## 9. Migration Plan

**Reused as-is:**
- Auth guard pattern in `frontend/app/filmmaker/page.tsx:37-52` (role check
  against `useAuthStore`) — just widen the allowed-role list.
- `NavBar.tsx`, `ClientProviders.tsx`, layout shell, `.card` / `.btn-primary`
  / `input-field` Tailwind utility classes.
- `/analytics` pages — untouched; they gain a new upstream data source
  (`datasets/`) instead of being rewritten.
- Backend auth/JWT middleware (`backend/auth_utils.py`) and the
  Firestore client (`backend/firebase_db.py`).

**Removed:**
- `frontend/app/filmmaker/movies/**` (add/edit/analytics-per-movie pages).
- `filmmakersApi.listMovies/deleteMovie` etc. and `FilmmakerMovie` type in
  `frontend/lib/api.ts`.
- `GENRES` constant, genre filter UI, movie table — none of it generalizes.
- `backend/routers/movies.py` movie-CRUD endpoints (keep read-only endpoints
  only if `/analytics` still depends on seeded movie data — confirm before
  deleting).

**Step-by-step:**
1. **Backend:** add `producer | distributor | cinema_operator |
   research_partner | studio_analyst` to `UserRole` in `backend/models.py`;
   add `organizations` collection + `orgId` on `users`.
2. **Backend:** new `backend/routers/data_portal.py` exposing the
   `dataPortalApi` endpoints from §7; wire signed-URL issuance for Storage
   uploads.
3. **Infra:** provision Firebase Storage buckets (`filmiq-uploads`,
   `filmiq-processed`) and the three Cloud Functions in §8.
4. **Frontend:** scaffold `components/data-portal/*` and
   `app/filmmaker/submit/[step]/*` per §7; build `UploadWizard` against a
   stubbed API first (no live validation) to unblock UI work.
5. **Frontend:** replace `app/filmmaker/page.tsx` body with
   `SubmissionDashboard` — keep the existing auth-guard `useEffect` verbatim,
   only widen the role list.
6. **Wire validation/transformation** Cloud Functions to real
   `processingJobs`/`validationResults` once the wizard UI is stable.
7. **Cutover:** point `/analytics` pages at `datasets/` for any metric that
   used to come from seeded movie data; delete `movies/**` routes/pages and
   `filmmakersApi` movie methods.
8. **Cleanup:** remove `GENRES`, `STATUS_BADGE` (movie-specific), and the
   movie table markup from the old page once `SubmissionDashboard` is live.

This sequencing keeps `/filmmaker` working end-to-end at every step (no
big-bang rewrite) and lets `/analytics` migrate to the new pipeline
independently of the portal UI work.
