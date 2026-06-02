# FilmIQ — African Cinema Intelligence Platform

> *Data-Driven Intelligence for African Cinema*

A full-stack film analytics platform powered by AI, Business Intelligence, and predictive machine learning. Built for the Ugandan and African film industry.

---

## 📸 Platform Overview

| Page | Description |
|------|-------------|
| **Dashboard** | Revenue analytics, KPIs, genre performance, top films from 9,999-film dataset |
| **AI Predictor** | Box office prediction using CNN-C methodology (83.7% accuracy) + Claude AI |
| **Analytics Studio** | Interactive BI — scatter, trend, seasonal, and language drill-downs |
| **Investor Intel** | ROI matrix, risk analysis, African market growth projections |

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
├── backend/                    # FastAPI backend
│   ├── main.py                 # Application entry point
│   ├── models.py               # SQLAlchemy ORM models
│   ├── database.py             # Async PostgreSQL connection
│   ├── config.py               # Settings (env vars)
│   ├── auth_utils.py           # JWT authentication
│   └── routers/
│       ├── auth.py             # Login, register, refresh
│       ├── movies.py           # CRUD + search
│       ├── predictions.py      # AI prediction endpoints
│       ├── analytics.py        # Dashboard analytics
│       ├── sentiment.py        # Comment scoring
│       └── investors.py        # ROI & risk intelligence
│
├── ml/
│   ├── predictor.py            # Main CNN-C predictor + training pipeline
│   ├── sentiment.py            # TF-IDF sentiment analysis
│   ├── feature_engineering.py  # Dataset preprocessing
│   └── saved_models/           # Pickled trained models
│
├── frontend/                   # Next.js 14 frontend (TypeScript)
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── dashboard/
│   │   ├── predict/
│   │   ├── analytics/
│   │   └── investor/
│   ├── components/
│   │   ├── charts/             # Recharts/ECharts wrappers
│   │   ├── ui/                 # ShadCN components
│   │   └── dashboard/          # Dashboard-specific widgets
│   └── lib/
│       ├── api.ts              # API client
│       └── types.ts            # TypeScript types
│
├── docker/
│   ├── docker-compose.yml
│   ├── nginx/nginx.conf
│   └── postgres/init.sql
│
├── data/
│   └── dataset_1_collected_data.csv   # TMDB 9,999-film dataset
│
└── docs/
    ├── API.md                  # Full API documentation
    └── DEPLOYMENT.md           # Production deployment guide
```

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
#   DB_PASSWORD=your_secure_password
#   JWT_SECRET=your_jwt_secret
```

### 2. Place Dataset

```bash
cp path/to/dataset_1_collected_data.csv data/
```

### 3. Start with Docker

```bash
docker compose up -d

# Train ML models (first time only)
docker compose --profile training up ml_worker
```

### 4. Seed the database

```bash
docker compose --profile seed up seeder
```

### 5. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Demo credentials

> ⚠️ Change these immediately in any non-local environment.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@filmiq.africa | filmiq_admin_2025 |
| Analyst | analyst@filmiq.africa | demo1234 |

Self-registration is disabled. Only admins can create new accounts via **Admin Panel → Users → Add User**.

---

## 💻 Local Development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL (Docker)
docker compose up db redis -d

# Run migrations
alembic upgrade head

# Seed data
python scripts/seed_data.py

# Start API
uvicorn main:app --reload --port 8000
```

### ML Training

```bash
cd ml
pip install scikit-learn xgboost pandas numpy textblob nltk

# Train all models
python predictor.py --train ../data/dataset_1_collected_data.csv

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

The platform includes specialized analytics for:

- **Uganda** — 3 major multiplex operators, growing middle-class audience
- **Nigeria** — Nollywood, largest African film economy
- **Kenya, Ghana, South Africa** — Regional distribution hubs
- **Pan-African** — 54-nation content strategy
- **African Diaspora** — Global streaming distribution

Market projections show **18% CAGR** through 2030.

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
  "predicted_revenue": 8200000,
  "predicted_opening_weekend": 2296000,
  "predicted_roi": 64.0,
  "confidence": 0.837,
  "model_used": "CNN-C",
  "genre_multiplier": 1.60,
  "risk_level": "MODERATE",
  "ai_analysis": "...",
  "recommendation": "Consider summer release window for +38% uplift"
}
```

### Sentiment Analysis
```http
POST /api/sentiment/analyze
{
  "comments": [
    {"text": "Amazing film, best of the year!", "days_before": 3},
    {"text": "Boring and predictable", "days_before": 7}
  ]
}
```

---

## 🗄 Database Schema

Key tables: `users`, `movies`, `genres`, `movie_cast`, `movie_crew`, `persons`, `predictions`, `audience_sentiment`, `streaming_stats`, `investors`, `reports`

See `backend/models.py` for full SQLAlchemy definitions with all column types and relationships.

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, Framer Motion, ShadCN UI, Recharts |
| Backend | FastAPI, Python 3.11, Async SQLAlchemy, Alembic |
| Database | PostgreSQL 16, Redis 7 |
| ML | scikit-learn, XGBoost, pandas, NumPy, TextBlob, NLTK |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Auth | JWT (python-jose) |
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

Built for the Ugandan and African film industry 🎬🌍
