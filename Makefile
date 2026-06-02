# FilmIQ — Developer Makefile
# Usage: make <target>

.PHONY: help install dev test seed train docker-up docker-down migrate clean

PYTHON  = python3
PIP     = pip3
NODE    = node
NPM     = npm
DC      = docker compose -f docker/docker-compose.yml

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo "FilmIQ — Available commands:"
	@echo ""
	@echo "  Setup:"
	@echo "    make install     Install all Python + Node dependencies"
	@echo "    make env         Copy .env.example to .env"
	@echo ""
	@echo "  Development:"
	@echo "    make dev-api     Start FastAPI backend (port 8000)"
	@echo "    make dev-web     Start Next.js frontend (port 3000)"
	@echo "    make dev         Start both (requires tmux or two terminals)"
	@echo ""
	@echo "  Database:"
	@echo "    make migrate     Run Alembic migrations"
	@echo "    make seed        Seed database with genres, movies, admin user"
	@echo ""
	@echo "  ML:"
	@echo "    make train       Train all ML models on TMDB dataset"
	@echo "    make test-ml     Run ML unit tests only"
	@echo ""
	@echo "  Testing:"
	@echo "    make test        Run full pytest suite (62 tests)"
	@echo "    make test-v      Run tests with verbose output"
	@echo ""
	@echo "  Docker:"
	@echo "    make docker-up   Start all services (DB, Redis, API, Frontend, Nginx)"
	@echo "    make docker-down Stop all services"
	@echo "    make docker-logs Stream all container logs"
	@echo ""
	@echo "  Other:"
	@echo "    make clean       Remove __pycache__, .next, dist"

# ── Setup ─────────────────────────────────────────────────────────────────────
env:
	@test -f .env || (cp .env.example .env && echo "✅ .env created — edit it with your credentials")

install: env
	@echo "Installing Python dependencies..."
	$(PIP) install -r backend/requirements.txt
	@echo "Installing Node dependencies..."
	cd frontend && $(NPM) ci
	@echo "Downloading NLTK data..."
	$(PYTHON) -c "import nltk; nltk.download('stopwords', quiet=True); nltk.download('punkt', quiet=True)"
	@echo "✅ All dependencies installed"

# ── Development ───────────────────────────────────────────────────────────────
dev-api:
	cd backend && ML_MODEL_PATH=../ml/saved_models uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd frontend && $(NPM) run dev

# ── Database ──────────────────────────────────────────────────────────────────
migrate:
	cd backend && alembic upgrade head

seed:
	$(PYTHON) backend/scripts/seed_data.py

# ── ML ────────────────────────────────────────────────────────────────────────
train:
	$(PYTHON) ml/predictor.py --train data/dataset_1_collected_data.csv

# ── Testing ───────────────────────────────────────────────────────────────────
test:
	pytest tests/ -q

test-v:
	pytest tests/ -v --tb=short

test-ml:
	pytest tests/ml/ -v

test-backend:
	pytest tests/backend/ -v

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	$(DC) up -d --build
	@echo "✅ Services started"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:8000"
	@echo "   API Docs: http://localhost:8000/docs"

docker-train:
	$(DC) --profile training up ml_worker

docker-seed:
	$(DC) exec backend python scripts/seed_data.py

docker-down:
	$(DC) down

docker-logs:
	$(DC) logs -f

docker-ps:
	$(DC) ps

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/.next frontend/node_modules 2>/dev/null || true
	@echo "✅ Clean complete"
