FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev zlib1g-dev libwebp-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py db.py models.py auth.py helpers.py ./
COPY routes/ ./routes/

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-3000}"]
