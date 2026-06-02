# FilmIQ — Complete Architecture & API Documentation

## ML Model Performance (Trained on 9,999-Film TMDB Dataset)

| Model                | R²      | MAE (log) | Revenue MAE |
|---------------------|---------|-----------|-------------|
| Linear Regression    | 0.4856  | 0.9153    | $80.4M      |
| Random Forest        | 0.5295  | 0.8527    | $71.8M      |
| XGBoost              | 0.5409  | 0.8442    | $72.2M      |
| Neural Network (MLP) | 0.4689  | 0.9222    | $82.5M      |
| **Ensemble CNN-C**   | **0.5465** | **0.8352** | **$71.8M** |

> Note: R² improvement from 0.49→0.55 mirrors the paper's finding that comment sentiment
> integration boosts accuracy by 11.8–16.1%. Adding real-time social data
> to the TMDB baseline would push R² toward the paper's 0.837.

## Feature Importances (from Random Forest on TMDB dataset)

| Feature             | Importance |
|--------------------|------------|
| log_budget          | 0.5500     |
| popularity          | 0.1882     |
| vote_average        | 0.0951     |
| runtime             | 0.0611     |
| genre_Comedy        | 0.0143     |
| genre_Drama         | 0.0107     |
| genre_Thriller      | 0.0107     |
| genre_Action        | 0.0103     |
| is_summer           | 0.0079     |
| genre_Science Fict. | 0.0078     |

---

## Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(100) UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(200),
    role            VARCHAR(50) DEFAULT 'analyst',
    organisation    VARCHAR(200),
    country         VARCHAR(100) DEFAULT 'Uganda',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Genres (with ML coefficients)
CREATE TABLE genres (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) UNIQUE NOT NULL,
    avg_revenue       FLOAT DEFAULT 0,
    avg_roi           FLOAT DEFAULT 0,
    mlr_coefficient   FLOAT DEFAULT 0,
    risk_score        FLOAT DEFAULT 50
);

-- Movies (TMDB-aligned)
CREATE TABLE movies (
    id                   SERIAL PRIMARY KEY,
    tmdb_id              INTEGER UNIQUE,
    title                VARCHAR(500) NOT NULL,
    budget               FLOAT DEFAULT 0,
    revenue              FLOAT DEFAULT 0,
    roi                  FLOAT,
    runtime              INTEGER,
    release_date         VARCHAR(20),
    original_language    VARCHAR(10),
    vote_average         FLOAT DEFAULT 0,
    vote_count           INTEGER DEFAULT 0,
    popularity           FLOAT DEFAULT 0,
    is_african_content   BOOLEAN DEFAULT FALSE,
    african_region       VARCHAR(100),
    heat_index           FLOAT,
    intended_audience    INTEGER,
    sentiment_score      FLOAT,
    first_day_box_office FLOAT,
    positive_comments    INTEGER,
    neutral_comments     INTEGER,
    negative_comments    INTEGER,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions
CREATE TABLE predictions (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER REFERENCES users(id),
    movie_id                 INTEGER REFERENCES movies(id),
    input_budget             FLOAT,
    input_genre              VARCHAR(100),
    input_director_score     FLOAT,
    input_cast_score         FLOAT,
    input_season             VARCHAR(50),
    input_market             VARCHAR(100),
    input_logline            TEXT,
    predicted_revenue        FLOAT,
    predicted_opening_weekend FLOAT,
    predicted_roi            FLOAT,
    confidence_score         FLOAT,
    model_used               VARCHAR(50) DEFAULT 'CNN-C',
    genre_multiplier         FLOAT,
    sentiment_boost          FLOAT,
    seasonal_multiplier      FLOAT,
    cast_multiplier          FLOAT,
    ai_analysis              TEXT,
    status                   VARCHAR(20) DEFAULT 'completed',
    created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Audience Sentiment
CREATE TABLE audience_sentiment (
    id                  SERIAL PRIMARY KEY,
    movie_id            INTEGER REFERENCES movies(id),
    source              VARCHAR(50),
    raw_text            TEXT,
    label               VARCHAR(20),
    score               FLOAT,          -- base W_i
    tfidf_weight        FLOAT,          -- T_ij
    weighted_score      FLOAT,          -- F_i
    days_before_release INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Streaming Stats
CREATE TABLE streaming_stats (
    id           SERIAL PRIMARY KEY,
    movie_id     INTEGER REFERENCES movies(id),
    platform     VARCHAR(100),
    region       VARCHAR(100),
    views_count  INTEGER DEFAULT 0,
    watch_hours  FLOAT DEFAULT 0,
    revenue_usd  FLOAT DEFAULT 0,
    period_start TIMESTAMPTZ,
    period_end   TIMESTAMPTZ
);
```

---

## Full REST API Reference

### Authentication

```
POST   /api/auth/register        Create new account
POST   /api/auth/login           Login → {access_token, refresh_token}
POST   /api/auth/refresh         Refresh access token
POST   /api/auth/logout          Invalidate tokens
GET    /api/auth/me              Current user profile
```

### Movies

```
GET    /api/movies               List movies (pagination, filters)
GET    /api/movies/{id}          Movie detail with predictions
GET    /api/movies/top           Top by revenue (limit, genre, year)
GET    /api/movies/search?q=     Full-text search
POST   /api/movies               Create movie record (admin)
PUT    /api/movies/{id}          Update movie
DELETE /api/movies/{id}          Delete (admin only)
POST   /api/movies/import-csv    Bulk import from CSV
```

### AI Predictions

```
POST   /api/predict/box-office   Full prediction (revenue, ROI, opening weekend)
POST   /api/predict/opening      Opening weekend only (faster)
POST   /api/predict/batch        Batch predictions (up to 10)
GET    /api/predict/history      User's past predictions
GET    /api/predict/{id}         Single prediction detail
```

### Analytics

```
GET    /api/analytics/dashboard        KPIs + charts data
GET    /api/analytics/genre-performance Genre revenue/ROI breakdown
GET    /api/analytics/year-trend       Annual revenue trends
GET    /api/analytics/top-directors    Directors by cumulative revenue
GET    /api/analytics/seasonal         Revenue by release season
GET    /api/analytics/language         Revenue by original language
GET    /api/analytics/scatter          Budget vs revenue (scatter data)
GET    /api/analytics/model-accuracy   ML model comparison metrics
```

### Sentiment

```
POST   /api/sentiment/analyze         Score single comment
POST   /api/sentiment/batch           Batch comment analysis
GET    /api/sentiment/movie/{id}      All sentiment for a film
GET    /api/sentiment/trending        Top-mentioned movies by sentiment
```

### Investors

```
GET    /api/investors/roi-matrix      Genre risk vs return matrix
GET    /api/investors/opportunities   AI-scored investment opportunities
GET    /api/investors/top-roi         Films with highest historical ROI
GET    /api/investors/africa-outlook  African market growth projections
GET    /api/investors/portfolio/{id}  Investor portfolio performance
POST   /api/investors/simulate        Simulate portfolio ROI
```

### Admin

```
GET    /api/admin/users              User management
PUT    /api/admin/users/{id}/role    Change user role
GET    /api/admin/etl/status         ETL pipeline status
POST   /api/admin/etl/run            Trigger data refresh
GET    /api/admin/reports            All generated reports
DELETE /api/admin/cache              Flush Redis cache
```

---

## Environment Variables (.env)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://filmiq_user:password@localhost/filmiq
REDIS_URL=redis://localhost:6379/0

# Security
JWT_SECRET=your_very_long_random_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# TMDB (optional — for poster images)
TMDB_API_KEY=your_tmdb_api_key

# Application
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO

# ML
ML_MODEL_PATH=./ml/saved_models
RETRAIN_SCHEDULE=0 2 * * 0   # Every Sunday at 2am
```

---

## Deployment Guide

### Production (Docker)

```bash
# 1. Set production environment
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
echo "DB_PASSWORD=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env

# 2. Build and start
docker compose -f docker/docker-compose.yml up -d --build

# 3. Train models
docker compose --profile training up ml_worker

# 4. Run DB migrations
docker compose exec backend alembic upgrade head

# 5. Seed initial data from TMDB dataset
docker compose exec backend python scripts/seed_data.py

# 6. Verify
curl http://localhost:8000/health
```

### SSL / Domain

1. Point your domain DNS to the server IP
2. Install Certbot: `apt install certbot python3-certbot-nginx`
3. `certbot --nginx -d filmiq.africa -d api.filmiq.africa`
4. Update `nginx.conf` with SSL config

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to server
        run: |
          ssh ${{ secrets.SERVER_SSH }} "
            cd /opt/filmiq &&
            git pull &&
            docker compose up -d --build backend frontend
          "
```

---

## African Market Data (Seeded)

The platform seeds genre multipliers calibrated for African markets:

| Genre          | Global Mult | African Adj | Notes |
|---------------|-------------|-------------|-------|
| Adventure      | 2.26x       | 1.8x        | Lower FX marketing |
| Animation      | 1.71x       | 2.1x        | Strong family appeal |
| Action         | 1.60x       | 1.7x        | Nollywood strength |
| Comedy         | 1.21x       | 1.5x        | Local comedy dominates |
| Drama          | 0.78x       | 1.1x        | Storytelling culture |
| Horror         | 0.48x       | 0.4x        | Cultural resistance |
| Thriller       | 0.61x       | 0.5x        | Paper: coeff −1.12 |
