# FilmIQ — Uganda's Cinema Intelligence Platform

> *Data-Driven Intelligence for Ugandan Cinema*

A full-stack film analytics platform powered by AI, Business Intelligence, and predictive machine learning. Built for the Ugandan film industry.

---

## 📸 Platform Overview

| Page | Description |
|------|-------------|
| **Dashboard** | Revenue analytics, KPIs, genre performance, top films from the 4,803-film TMDb dataset |
| **AI Predictor** | Box office prediction using CNN-C methodology (83.7% accuracy) + Claude AI |
| **Analytics Studio** | Interactive BI — scatter, trend, seasonal, and language drill-downs |
| **Movies / Genres / People / Trends / Overview / Compare** | Catalog browsing, cross-genre and cross-title comparisons |
| **Investor Intel** | ROI matrix, risk analysis, illustrative African market benchmarks |
| **Data Portal** | Submit structured datasets (box office, streaming, audience research, marketing, production, custom) via a CSV upload wizard — column mapping, validation, and an admin review/approve workflow |
| **Admin Panel** | User management, account bootstrap |

---

## 🧠 ML Methodology

Based on **Zhang et al. (2024)** — *"Prediction techniques of movie box office using neural networks and emotional mining"* (Scientific Reports, 14:21209).

### Models Implemented

| Model | Accuracy | Notes |
|-------|----------|-------|
| MLR (no comments) | 63% | Baseline |
| BPNN | 68% | Back-propagation NN |
| CNN | 72% | Convolutional NN |
| MLR + Comments | 80% | +16.1% from sentiment |
| **CNN-C** | **83.7%** | **Best — used in production** |

### 34 Influencing Factors (11 Categories)

1. **Movie Types** — 14 genre categories (one-hot encoded)
2. **Production Countries** — 4 regional categories  
3. **Directors** — favoritism/popularity score
4. **Actors** — top-4 cast average score (MLR coeff: **1.2157**)
5. **IP Adaptation** — binary flag (boosts: **+0.369**)
6. **Intended Audience** — pre-release ticket interest (coeff: **0.962**)
7. **Heat Index** — Baidu/search trend 90 days pre-release (coeff: **0.861**)
8. **Release Schedule** — Winter/Summer/Holiday/General
9. **Word-of-Mouth** — ratings + comment count
10. **Emotional Tendency** — TF-IDF weighted sentiment: F_i = (W_i − 0.5) × Σ(T_ij + 1)
11. **First-day Box Office** — strongest predictor (coeff: **1.222**)

### Sentiment Formula

```
F_i = (W_i - 0.5) × Σ(T_ij + 1)

Temporal weights (pre-release):
  Level IV  (1–5 days):   weight = 0.40
  Level III (5–10 days):  weight = 0.25
  Level II  (10–20 days): weight = 0.20
  Level I   (20–30 days): weight = 0.15

F_total = Σ(T_V × weight_V)
```

---

## 🗂 Project Structure

```
filmiq/
├── backend/                    # FastAPI backend (Firestore edition)
│   ├── main.py                 # Application entry point
│   ├── models.py               # Pydantic models
│   ├── firebase_db.py          # Firestore client
│   ├── config.py               # Settings (env vars)
│   ├── auth_utils.py           # Password hashing / JWT helpers
│   ├── tmdb_service.py         # TMDb poster/backdrop lookups
│   ├── movie_dataset.py        # Dataset loading helpers
│   ├── analytics_service.py    # Analytics aggregation
│   └── routers/
│       ├── auth.py             # Login, refresh, change-password (self-registration disabled)
│       ├── movies.py           # CRUD + search
│       ├── predictions.py      # AI prediction endpoints
│       ├── analytics.py        # Dashboard analytics
│       ├── sentiment.py        # Comment scoring
│       ├── investors.py        # ROI & risk intelligence
│       ├── admin.py            # User management
│       ├── chat.py             # AI chat
│       └── data_portal.py      # Data Portal: templates, submissions, validation, review
│
├── ml/
│   ├── predictor.py            # Main CNN-C predictor + training pipeline
│   ├── sentiment.py            # TF-IDF sentiment analysis
│   └── saved_models/           # Pickled trained models
│
├── frontend/                   # Next.js 14 frontend (TypeScript)
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── dashboard/
│   │   ├── predict/
│   │   ├── analytics/
│   │   ├── investor/
│   │   ├── movies/, genres/, people/, trends/, overview/, compare/
│   │   ├── filmmaker/           # Data Portal: dashboard, submit/ wizard, submissions/[id]
│   │   ├── admin/
│   │   └── auth/                # login, register, change-password, forgot-password
│   ├── components/
│   │   ├── NavBar.tsx
│   │   ├── ClientProviders.tsx
│   │   ├── data-portal/         # SubmissionTable, ActivityFeed, ValidationPanel, UploadWizard
│   │   └── ui/                 # Cards, tooltips, poster/backdrop image components
│   └── lib/
│       ├── api.ts              # API client
│       ├── store.ts            # Client-side state
│       └── types.ts            # TypeScript types
│
├── docker/
│   ├── docker-compose.yml      # Alternate compose file (run from docker/)
│   └── nginx/nginx.conf        # Reverse proxy config, used by the root docker-compose.yml
│
└── data/
    └── movie_dataset.csv       # Movie dataset
```

---

## 🗄 Database (Firebase Firestore)

The backend stores data in Firebase Firestore — there's no local database server to run. Configure credentials via **one** of:

| Option | Env var(s) | Use case |
|--------|-----------|----------|
| Service-account JSON file | `FIREBASE_CREDENTIALS_PATH` | Local dev (default: `backend/firebase-credentials.json`) |
| Inline service-account JSON | `FIREBASE_CREDENTIALS` | Docker / CI / Cloud Run |
| Application Default Credentials | `FIREBASE_PROJECT_ID` | Cloud Run / GCE / `gcloud auth` |

Get a service-account key from **Firebase Console → Project Settings → Service Accounts → Generate new private key**. Authentication uses Firebase Authentication (Email/Password) alongside Firestore-stored user records — enable Email/Password sign-in under **Authentication → Sign-in method**.

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/filmiq.git
cd filmiq

cp .env.example .env
# Edit .env with your credentials:
#   ANTHROPIC_API_KEY=sk-ant-...
#   FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json   (or FIREBASE_CREDENTIALS / FIREBASE_PROJECT_ID)
#   JWT_SECRET=your_jwt_secret
```

### 2. Dataset

`data/movie_dataset.csv` (4,803 TMDb films) already ships with the repo — no action needed unless you want to swap in your own dataset:

```bash
cp path/to/your_dataset.csv data/movie_dataset.csv
```

### 3. Start with Docker

```bash
docker compose up -d

# Train ML models (first time only)
docker compose --profile training up ml_worker
```

A default admin account is bootstrapped automatically on first startup (see `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` in `.env.example`).

### 4. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Default admin account

> ⚠️ Change this password immediately in any non-local environment.

| Email | Password |
|-------|----------|
| admin@filmiq.africa | Admin@123 |

The account is force-flagged `must_change_password` on first login. Override via `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` in `.env`.

---

## 🔁 Running It Again (after initial setup)

Once `.env` is configured and the dataset is in place, you don't need to repeat the steps above. Just start the services:

### Docker

```bash
docker compose up -d

# Stop everything
docker compose down
```

### Local Development (no Docker)

```bash
# Terminal 1 — Backend
cd backend
source venv/bin/activate    # Windows: venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Then open http://localhost:3000.

---

## 💻 Local Development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate .\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Configure Firebase credentials (see .env.example)

# Start API
uvicorn main:app --reload --port 8000
```

### ML Training

```bash
cd ml
pip install scikit-learn xgboost pandas numpy textblob nltk

# Train all models
python predictor.py --train ../data/movie_dataset.csv

# Quick prediction test
python predictor.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 🌍 African Market Focus

The Investor Intel module (`backend/routers/investors.py`) presents market-share and growth figures for Uganda, Nigeria, Kenya, Ghana, and South Africa.

> ⚠️ No real African box-office/market-size dataset exists in this repo — the TMDb CSV has no country-of-market or regional revenue data. The market-size, market-share, and growth figures in Investor Intel are **illustrative placeholders**, not measured data. Treat them as a UI demo, not a source of truth, until a real regional dataset is wired in.

---

## 📡 API Reference

### Predict Box Office
```http
POST /api/predict/box-office
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "title": "The Uganda Chronicles",
  "budget": 5000000,
  "genre": "Action",
  "director_score": 0.7,
  "cast_score": 0.65,
  "season": "summer",
  "market": "pan_african",
  "sentiment_score": 0.25,
  "logline": "A cyberpunk thriller set in 2040 Kampala"
}
```

### Response
```json
{
  "title": "The Uganda Chronicles",
  "predicted_revenue": 8200000,
  "predicted_opening_weekend": 2296000,
  "predicted_roi": 64.0,
  "confidence": 0.837,
  "model_used": "CNN-C",
  "genre_multiplier": 1.60,
  "cast_multiplier": 1.12,
  "seasonal_multiplier": 1.08,
  "sentiment_boost": 0.05,
  "risk_level": "MODERATE",
  "ai_analysis": "...",
  "recommendation": "Consider summer release window for +38% uplift",
  "breakdown": { "...": "per-factor contribution detail" },
  "sentiment_analysis": null
}
```

### Sentiment Analysis

Single comment:
```http
POST /api/sentiment/analyze
{
  "text": "Amazing film, best of the year!",
  "days_before": 3
}
```

Batch of comments:
```http
POST /api/sentiment/batch
{
  "comments": [
    {"text": "Amazing film, best of the year!", "days_before": 3},
    {"text": "Boring and predictable", "days_before": 7}
  ]
}
```

---

## 🗄 Database Schema

Firestore collections: `users`, `predictions`, `reportTemplates`, `submissions`, `submissionVersions`, `validationResults`, `activityLogs`.

The movie catalog itself (browsed in Dashboard/Movies/Analytics) is read from `data/movie_dataset.csv` via `backend/movie_dataset.py`, not Firestore. The Data Portal (`/filmmaker`) stores user-submitted datasets in Firestore instead: `reportTemplates` holds user-defined schemas (field name/type/required/validation rules), `submissions` tracks each upload's lifecycle (`draft → submitted → under_review → approved/processed/rejected`), `submissionVersions` holds the parsed CSV rows + column mapping for each re-upload, `validationResults` holds the per-version error/warning/duplicate report, and `activityLogs` records who did what. AI chat (`/api/chat`) is stateless and does not persist history.

See `backend/models.py` for Pydantic schemas and `backend/firebase_db.py` for the Firestore client. Full Data Portal architecture (schema, pipeline, wizard flow, migration notes) is documented in [`docs/DATA_PORTAL_ARCHITECTURE.md`](docs/DATA_PORTAL_ARCHITECTURE.md).

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, Framer Motion, Recharts |
| Backend | FastAPI, Python 3.11 |
| Database | Firebase Firestore, Firebase Authentication, Redis 7 |
| ML | scikit-learn, XGBoost, pandas, NumPy, TextBlob, NLTK |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Auth | Firebase Auth + JWT (python-jose) |
| Infra | Docker, Nginx, GitHub Actions CI/CD |

---

## 📄 Research Reference

This platform implements the methodology from:

> Zhang, Z., Meng, Y., & Xiao, D. (2024). Prediction techniques of movie box office using neural networks and emotional mining. *Scientific Reports*, 14, 21209. https://doi.org/10.1038/s41598-024-72340-z

**Key findings incorporated:**
- CNN-C (CNN + Comments) achieves 83.7% average prediction accuracy
- Sentiment integration improves MLR by +16.1%, CNN by +11.8%
- Negative comments are the strongest box office negative factor (coeff: −2.369)
- Positive comments: +1.862 coefficient; actor score: +1.216; director: +1.022

---

## 📝 License

MIT License — FilmIQ Platform © 2025

Built for the Ugandan film industry 🎬🇺🇬

---

## 👤 Developer Information

Makerere University
College of Computing and Information Sciences
Department of Information Systems
BIST III Group 50
