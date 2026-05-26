"""
pytest fixtures for the Brandora AI test suite.
"""
import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.schemas.base import Base
from app.schemas.user import User, UserOrganizationMembership
from app.schemas.organization import Organization

# ── Test database ─────────────────────────────────────────────────────────────
# Use an in-memory SQLite database for tests to avoid needing a real Postgres.
# Note: asyncpg requires PostgreSQL in production; for tests we use aiosqlite.
TEST_DB_URL = "sqlite+aiosqlite:///./test_brandora.db"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_tables():
    """Create all tables before test session, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a test database session that rolls back after each test."""
    async with test_session_factory() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client with DB override."""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_org(db: AsyncSession) -> Organization:
    """Create a test organization."""
    org = Organization(
        id=uuid.uuid4(),
        name="Test Hygiene NGO",
        slug=f"test-ngo-{uuid.uuid4().hex[:8]}",
        sector="menstrual_hygiene",
        subscription_tier="free",
        ai_generations_limit=20,
        ai_generations_used=0,
    )
    db.add(org)
    await db.flush()
    return org


@pytest_asyncio.fixture
async def test_user(db: AsyncSession, test_org: Organization) -> User:
    """Create a test user with org membership."""
    user = User(
        id=uuid.uuid4(),
        email=f"test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("testpassword123"),
        full_name="Test User",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    membership = UserOrganizationMembership(
        id=uuid.uuid4(),
        user_id=user.id,
        organization_id=test_org.id,
        role="admin",
        is_active=True,
    )
    db.add(membership)
    await db.flush()
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user: User, test_org: Organization) -> dict:
    """Return Authorization headers with a valid access token."""
    token = create_access_token({"sub": str(test_user.id), "org_id": str(test_org.id)})
    return {"Authorization": f"Bearer {token}"}
