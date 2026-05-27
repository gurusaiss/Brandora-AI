# ============================================================
# Brandora AI Backend — Multi-stage Dockerfile
# Stage 1: development  (local dev with hot-reload)
# Stage 2: builder      (compile wheels)
# Stage 3: production   (minimal runtime)
# ============================================================

# ── Stage 1: Development (used by docker-compose locally) ────
FROM python:3.11-slim AS development

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (code is volume-mounted, so we only need deps here)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Hot-reload enabled for development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ── Stage 2: Builder (production dependency compilation) ──────
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 3: Production ───────────────────────────────────────
FROM python:3.11-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r brandora && useradd -r -g brandora -d /app -s /sbin/nologin brandora

WORKDIR /app

COPY --from=builder /install /usr/local
COPY --chown=brandora:brandora . .

RUN mkdir -p /app/logs /app/tmp && chown -R brandora:brandora /app

USER brandora

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--access-log"]
