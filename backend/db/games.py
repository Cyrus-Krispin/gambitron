"""Game CRUD operations."""
import uuid

from db.connection import get_pool

# In-memory fallback when DB unavailable (local dev)
_memory_games: dict[uuid.UUID, dict] = {}


async def create_game(time_control_ms: int, player_color: str) -> uuid.UUID:
    """Create a new game. Returns game_id. Uses in-memory when DB unavailable (local dev)."""
    pool = get_pool()
    if not pool:
        gid = uuid.uuid4()
        _memory_games[gid] = {
            "id": gid,
            "time_control_ms": time_control_ms,
            "player_color": player_color,
            "ended_at": None,
        }
        return gid
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO games (time_control_ms, player_color)
            VALUES ($1, $2)
            RETURNING id
            """,
            time_control_ms,
            player_color,
        )
        return row["id"]


async def get_game(game_id: uuid.UUID) -> dict | None:
    """Get a game by ID. Returns None if not found or DB unavailable."""
    pool = get_pool()
    if not pool:
        g = _memory_games.get(game_id)
        return dict(g) if g else None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, created_at, ended_at, time_control_ms, result, termination, player_color, pgn, metadata FROM games WHERE id = $1",
            game_id,
        )
        if not row:
            return None
        return dict(row)


async def list_games(
    limit: int = 20,
    offset: int = 0,
    has_pgn: bool | None = None,
) -> tuple[list[dict], int]:
    """List games with pagination. Returns (games, total_count).
    If has_pgn=True, only returns games with non-null PGN."""
    pool = get_pool()
    if not pool:
        return [], 0
    async with pool.acquire() as conn:
        where = "WHERE pgn IS NOT NULL AND pgn != ''" if has_pgn else ""
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM games {where}"
        )
        rows = await conn.fetch(
            f"""
            SELECT id, created_at, ended_at, time_control_ms, result, termination, player_color
            FROM games
            {where}
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset,
        )
        games = [dict(r) for r in rows]
        return games, total or 0


async def update_game_ended(
    game_id: uuid.UUID,
    result: str,
    termination: str,
    pgn: str | None = None,
) -> bool:
    """Update game when it ends. Returns True if updated."""
    pool = get_pool()
    if not pool:
        if game_id in _memory_games:
            _memory_games[game_id]["ended_at"] = "now"
            _memory_games[game_id]["result"] = result
            _memory_games[game_id]["termination"] = termination
            if pgn is not None:
                _memory_games[game_id]["pgn"] = pgn
        return True
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE games
            SET ended_at = now(), result = $2, termination = $3, pgn = $4
            WHERE id = $1
            """,
            game_id,
            result,
            termination,
            pgn,
        )
        return True
