FROM node:18-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ .
RUN yarn build

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev zlib1g-dev libwebp-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files flat into /app (same structure as backend/Dockerfile)
COPY backend/server.py backend/db.py backend/models.py backend/auth.py backend/helpers.py ./
COPY backend/routes/ ./routes/

# Copy frontend build
COPY --from=frontend-build /app/frontend/build ./frontend/build

RUN mkdir -p /app/uploads/thumbnails

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
