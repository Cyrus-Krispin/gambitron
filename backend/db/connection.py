"""PostgreSQL connection pool."""
import asyncpg

from config import DATABASE_URL

_pool: asyncpg.Pool | None = None
_connection_error: str | None = None


async def create_pool() -> asyncpg.Pool | None:
    """Create connection pool. Returns None if DATABASE_URL is not set or connection fails."""
    global _pool, _connection_error
    _connection_error = None
    if not DATABASE_URL:
        return None
    try:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
        return _pool
    except Exception as e:
        _connection_error = str(e)
        _pool = None
        return None


def get_connection_error() -> str | None:
    """Return the last connection error, if any."""
    return _connection_error


def get_pool() -> asyncpg.Pool | None:
    """Get the connection pool. Returns None if DB is not configured."""
    return _pool


async def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
