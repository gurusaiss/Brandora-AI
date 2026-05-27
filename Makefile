.PHONY: help dev dev-logs stop build rebuild \
        backend-shell frontend-shell \
        migrate migrate-create seed \
        test-backend test-frontend test \
        lint format \
        logs-backend logs-worker logs-frontend \
        clean ps

# ── Default target ────────────────────────────────────────────
.DEFAULT_GOAL := help

# ── Help ─────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── First-time setup ──────────────────────────────────────────
setup: ## Copy .env.example → .env (run once before anything else)
	@if [ -f .env ]; then \
		echo "  ✓  .env already exists — skipping (delete it first to reset)"; \
	else \
		cp .env.example .env && echo "  ✓  Created .env from .env.example — fill in your API keys"; \
	fi

# ── Development ───────────────────────────────────────────────
dev: ## Start all services for local development
	docker-compose up -d

dev-build: ## Build images then start all services
	docker-compose up -d --build

dev-logs: ## Follow logs for all services
	docker-compose logs -f

stop: ## Stop all services (keep volumes)
	docker-compose down

build: ## Rebuild all Docker images (no cache)
	docker-compose build --no-cache

rebuild: ## Stop, rebuild, and restart all services
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

ps: ## Show running container status
	docker-compose ps

# ── Shells ────────────────────────────────────────────────────
backend-shell: ## Open a bash shell inside the backend container
	docker-compose exec backend bash

frontend-shell: ## Open a sh shell inside the frontend container
	docker-compose exec frontend sh

postgres-shell: ## Open a psql shell
	docker-compose exec postgres psql -U brandora -d brandora_ai

redis-shell: ## Open a redis-cli shell
	docker-compose exec redis redis-cli

# ── Database ──────────────────────────────────────────────────
migrate: ## Apply all pending Alembic migrations
	docker-compose exec backend alembic upgrade head

migrate-create: ## Create a new migration (usage: make migrate-create name="add_users_table")
	@if [ -z "$(name)" ]; then echo "ERROR: provide a name — usage: make migrate-create name=\"description\""; exit 1; fi
	docker-compose exec backend alembic revision --autogenerate -m "$(name)"

migrate-down: ## Roll back the last migration
	docker-compose exec backend alembic downgrade -1

migrate-history: ## Show migration history
	docker-compose exec backend alembic history --verbose

seed: ## Seed database with initial data
	docker-compose exec backend python -m app.utils.seed

# ── Testing ───────────────────────────────────────────────────
test-backend: ## Run backend tests with pytest
	docker-compose exec backend pytest -v --tb=short

test-backend-cov: ## Run backend tests with coverage report
	docker-compose exec backend pytest -v --tb=short --cov=app --cov-report=term-missing

test-frontend: ## Run frontend tests with Jest
	docker-compose exec frontend npm test -- --watchAll=false

test: test-backend test-frontend ## Run all tests

# ── Linting & Formatting ──────────────────────────────────────
lint: ## Run linting on backend and frontend
	docker-compose exec backend ruff check app/
	docker-compose exec frontend npm run lint

lint-fix: ## Auto-fix linting issues where possible
	docker-compose exec backend ruff check app/ --fix
	docker-compose exec frontend npm run lint -- --fix

format: ## Format all code (ruff + prettier)
	docker-compose exec backend ruff format app/
	docker-compose exec frontend npm run format

type-check: ## Run type checks (mypy + tsc)
	docker-compose exec backend mypy app/ --ignore-missing-imports
	docker-compose exec frontend npm run type-check

# ── Logs ─────────────────────────────────────────────────────
logs-backend: ## Follow backend API logs
	docker-compose logs -f backend

logs-worker: ## Follow Celery worker logs
	docker-compose logs -f celery_worker

logs-beat: ## Follow Celery beat scheduler logs
	docker-compose logs -f celery_beat

logs-frontend: ## Follow frontend logs
	docker-compose logs -f frontend

logs-postgres: ## Follow postgres logs
	docker-compose logs -f postgres

# ── Production (local simulation) ────────────────────────────
prod-up: ## Start production compose stack locally
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down: ## Stop production compose stack
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# ── Cleanup ──────────────────────────────────────────────────
clean: ## Remove all containers, networks, and volumes (WARNING: deletes all local data)
	@echo "WARNING: This will delete all local database and redis data."
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker-compose down -v --remove-orphans
	docker system prune -f

clean-images: ## Remove project Docker images
	docker-compose down --rmi local
