FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev zlib1g-dev libwebp-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/server.py backend/db.py backend/models.py backend/auth.py backend/helpers.py ./
COPY backend/routes/ ./routes/

RUN mkdir -p /app/uploads/thumbnails

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
