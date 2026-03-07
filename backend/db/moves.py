"""Move CRUD operations."""
import uuid

from db.connection import get_pool

# In-memory fallback when DB unavailable (local dev)
_memory_moves: dict[uuid.UUID, list[dict]] = {}


async def insert_move(
    game_id: uuid.UUID,
    ply: int,
    fen: str,
    san: str,
    from_square: str | None = None,
    to_square: str | None = None,
) -> bool:
    """Insert a move. Returns True if inserted."""
    pool = get_pool()
    if not pool:
        if game_id not in _memory_moves:
            _memory_moves[game_id] = []
        _memory_moves[game_id].append(
            {"ply": ply, "fen": fen, "san": san, "from_square": from_square, "to_square": to_square}
        )
        return True
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO moves (game_id, ply, fen, san, from_square, to_square)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            game_id,
            ply,
            fen,
            san,
            from_square,
            to_square,
        )
        return True


async def get_move_count(game_id: uuid.UUID) -> int:
    """Get the number of moves for a game (for next ply)."""
    pool = get_pool()
    if not pool:
        return len(_memory_moves.get(game_id, []))
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM moves WHERE game_id = $1",
            game_id,
        )
        return count or 0


async def get_moves_by_game(game_id: uuid.UUID) -> list[dict]:
    """Get all moves for a game, ordered by ply."""
    pool = get_pool()
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ply, fen, san, from_square, to_square, created_at
            FROM moves
            WHERE game_id = $1
            ORDER BY ply ASC
            """,
            game_id,
        )
        return [dict(r) for r in rows]
