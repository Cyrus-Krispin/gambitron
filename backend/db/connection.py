"""PostgreSQL connection pool."""
import asyncpg

from config import DATABASE_URL

_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool | None:
    """Create connection pool. Returns None if DATABASE_URL is not set."""
    global _pool
    if not DATABASE_URL:
        return None
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
    return _pool


def get_pool() -> asyncpg.Pool | None:
    """Get the connection pool. Returns None if DB is not configured."""
    return _pool


async def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
