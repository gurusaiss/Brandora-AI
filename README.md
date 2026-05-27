# Brandora AI

> AI-powered Social Media & Digital Presence Platform for Sanitation and Menstrual Hygiene Organizations

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org/)

## Overview

Brandora AI is a purpose-built platform that helps sanitation and menstrual hygiene (MHM) organizations amplify their social impact through intelligent, automated content creation. It generates platform-optimized social media content, tracks awareness day calendars, manages CSR campaigns, and provides analytics — all tuned to the language and mission of WASH (Water, Sanitation and Hygiene) sector organizations.

**Who is it for?**
- NGOs and non-profits working in sanitation, menstrual health, and WASH
- CSR teams of corporations funding sanitation programmes
- Government agencies running public health awareness campaigns
- Social enterprises selling hygiene products to underserved communities

**Key Features**
- AI content generation for LinkedIn, Instagram, Twitter/X, and Facebook
- Festival & Awareness Day calendar (World MHD, World Toilet Day, etc.)
- Multi-language content support
- Brand voice training and CSR impact storytelling
- Campaign management with scheduling and a content calendar
- Analytics dashboard with reach, engagement, and SDG-alignment reporting
- Multi-brand and multi-user organization support

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | FastAPI 0.115, Python 3.11, SQLAlchemy 2.0 (async), Alembic |
| **AI** | OpenAI GPT-4o, Anthropic Claude 3.5, Google Gemini |
| **Database** | PostgreSQL 16 via Supabase |
| **Queue** | Redis + Celery (content, scheduler, analytics queues) |
| **Auth** | JWT (access + refresh tokens), Supabase Auth |
| **Infrastructure** | Docker Compose (local), Railway (MVP deployment) |
| **CI/CD** | GitHub Actions |

---

## Quick Start

> 💡 **Running this for the first time?** See [FREE_PLAN.md](./FREE_PLAN.md) for the
> complete free-tier setup guide. **You only need one free API key to get started.**

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+) — required
- [Make](https://www.gnu.org/software/make/) — optional but recommended
- [Google Gemini API Key](https://aistudio.google.com/app/apikey) — free, takes 2 minutes

### What You'll See When Running

| URL | What it shows |
|-----|--------------|
| `http://localhost:3000` | Main app — register, login, generate content |
| `http://localhost:8000/docs` | Interactive API explorer (Swagger UI) |
| `http://localhost:8000/redoc` | API reference docs |
| `http://localhost:5555` | Celery Flower — background job monitor |
| `localhost:5432` | PostgreSQL — connect via DBeaver/pgAdmin/TablePlus |
| `localhost:6379` | Redis — connect via Redis Insight |

### Local Development with Docker (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/gurusaiss/Brandora-AI.git
cd Brandora-AI

# 2. Create your .env from the template (ONE file for everything)
cp .env.example .env
# Open .env and fill in at minimum:
#   GOOGLE_AI_API_KEY=your_key_here     ← get free at aistudio.google.com
#   SECRET_KEY=any-32-char-random-string

# 3. Start all services (PostgreSQL + Redis + Backend + Celery + Frontend)
make dev
# or: docker-compose up -d

# 4. Run database migrations (first time only)
make migrate

# 5. Open the app
# → http://localhost:3000   (main UI — register an account)
# → http://localhost:8000/docs   (API explorer)
```

### Manual Setup (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# .env is read from the project root automatically
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev      # automatically loads root .env via dotenv-cli
```

> The `npm run dev` script uses `dotenv -e ../.env` to load the root `.env`
> automatically. No separate `frontend/.env.local` needed.

---

## Project Structure

```
brandora-ai/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, docker-build
│       ├── deploy-staging.yml        # Auto-deploy dev branch → Railway staging
│       └── deploy-production.yml     # Deploy on version tag → Railway production
├── backend/
│   ├── app/
│   │   ├── api/                      # Route handlers (FastAPI routers)
│   │   ├── core/                     # Config, security, database session
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── services/                 # Business logic (AI generation, social posting)
│   │   ├── workers/                  # Celery tasks and celery_app factory
│   │   └── main.py                   # FastAPI app entry point
│   ├── alembic/
│   │   ├── versions/                 # Migration files
│   │   └── seed.sql                  # Initial seed data
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env                          # Local only — not committed
├── frontend/
│   ├── app/                          # Next.js App Router pages
│   ├── components/                   # Shared UI components
│   ├── lib/                          # API client, utilities, hooks
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.local                    # Local only — not committed
├── .env.example                      # Master env vars reference (committed)
├── docker-compose.yml                # Local development
├── docker-compose.prod.yml           # Production overrides
├── railway.toml                      # Railway deployment config
├── Makefile                          # Developer convenience commands
└── README.md
```

---

## Environment Variables

All environment variables are documented in [.env.example](./.env.example).

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL async connection string |
| `SUPABASE_URL` | Supabase project URL |
| `REDIS_URL` | Redis connection string |
| `SECRET_KEY` | JWT signing key (min 32 chars) |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GOOGLE_AI_API_KEY` | Google AI key for Gemini |
| `NEXT_PUBLIC_API_URL` | Backend API URL (browser-visible) |

See `.env.example` for the full list including social OAuth credentials, email config, and monitoring keys.

---

## Development

### Backend

```bash
# Run tests
make test-backend

# Lint and format
make lint
make format

# Create a new migration
make migrate-create name="add_posts_table"

# Access backend container shell
make backend-shell
```

### Frontend

```bash
# Run tests
make test-frontend

# Type check + lint
docker-compose exec frontend npm run type-check
docker-compose exec frontend npm run lint

# Access frontend container shell
make frontend-shell
```

### Running Tests

```bash
# Backend only
make test-backend

# Frontend only
make test-frontend

# Both
make test-backend && make test-frontend
```

### Useful Commands

```bash
make help           # Show all available make targets
make logs-backend   # Follow backend logs
make logs-worker    # Follow Celery worker logs
make dev-logs       # Follow all service logs
make clean          # Remove all containers and volumes (WARNING: deletes data)
```

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions covering:
- Railway staging and production setup
- Environment variable configuration
- Database migration strategy
- Rollback procedures
- Future AWS migration path

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and ensure tests pass: `make test-backend && make test-frontend`
4. Run linting: `make lint`
5. Commit: `git commit -m "feat: your feature description"`
6. Push and open a Pull Request against the `dev` branch

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE) for details.

---

## Contact

- **Project Lead**: [gurusaiss](https://github.com/gurusaiss)
- **Repository**: [github.com/your-org/brandora-ai](https://github.com/your-org/brandora-ai)
- **Issues**: Please open a GitHub issue for bugs or feature requests
