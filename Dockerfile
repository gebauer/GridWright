# Stage 1: build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: production image
FROM python:3.12-slim
WORKDIR /app

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_CACHE_DIR=/tmp/poetry-cache

RUN pip install --no-cache-dir poetry==2.2.1

COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry install --only main --no-root && rm -rf $POETRY_CACHE_DIR

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV DB_PATH=/data/gridwright.db
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
