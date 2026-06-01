"""
Async SQLAlchemy engine and session factory.

Supabase transaction pooler (port 6543) does NOT support persistent
prepared statements, so we must pass statement_cache_size=0 via
connect_args and use NullPool (every request gets a fresh connection
from PgBouncer rather than a long-lived driver-level pool).
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Detect transaction pooler by port (6543) or explicit flag
_is_transaction_pooler = ":6543/" in settings.DATABASE_URL

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    # Use NullPool for Supabase transaction pooler — PgBouncer manages
    # the pool server-side; driver-side pooling causes "prepared statement
    # already exists" errors.
    poolclass=NullPool if _is_transaction_pooler else None,
    # Disable asyncpg prepared-statement cache for transaction pooler
    connect_args={"statement_cache_size": 0} if _is_transaction_pooler else {},
    # These only apply when NOT using NullPool
    **({} if _is_transaction_pooler else {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
    }),
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def check_db_connection() -> bool:
    """Ping the database. Returns True on success, False on failure."""
    try:
        async with engine.connect() as conn:
            from sqlalchemy import text

            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
