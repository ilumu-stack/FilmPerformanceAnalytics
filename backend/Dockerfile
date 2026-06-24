FROM python:3.12-slim

# Build context is the REPO ROOT (not backend/) so this can also COPY the
# sibling ml/ package — main.py imports `ml.sentiment`, which only existed
# locally via docker-compose's bind mounts. Render/Cloud Run have no such
# mounts, so it must be baked into the image here instead.

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data for sentiment analysis
RUN python -c "import nltk; nltk.download('stopwords', quiet=True); nltk.download('punkt', quiet=True)"

# Copy application code
COPY backend/ .
COPY ml/ ./ml/

# Create upload directory
RUN mkdir -p /tmp/filmiq_uploads && mkdir -p /app/ml/saved_models

EXPOSE 8000

# Default: run the API. Honors $PORT (Render/Cloud Run inject this; falls
# back to 8000 for docker-compose, which overrides this CMD anyway).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
