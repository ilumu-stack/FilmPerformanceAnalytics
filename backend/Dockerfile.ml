FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir xgboost textblob nltk && \
    python -c "import nltk; nltk.download('stopwords', quiet=True)"

COPY . .

# Default: run training pipeline
CMD ["python", "ml/predictor.py", "--train", "data/movie_dataset.csv"]
