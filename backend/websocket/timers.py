"""Game timer state and tick logic. Backend owns clocks and detects timeouts."""
import time
import uuid

import chess

from db import games as games_db
from db import moves as moves_db

# game_id -> timer state
_game_timers: dict[uuid.UUID, dict] = {}


def is_player_turn(fen: str, player_color: str) -> bool:
    """True if it's the human player's turn."""
    try:
        board = chess.Board(fen)
        is_white_turn = board.turn == chess.WHITE
        return (player_color == "white") == is_white_turn
    except ValueError:
        return False


def register_game(
    game_id: uuid.UUID,
    time_control_ms: int,
    player_color: str,
    fen: str,
) -> None:
    """Register a new game with timer. Both clocks start at time_control_ms.
    ai_first_move_pending: when player is black, AI moves first - don't tick until AI has moved.
    player_first_move_pending: when player is white, don't tick player clock until they move."""
    _game_timers[game_id] = {
        "player_time_ms": time_control_ms,
        "ai_time_ms": time_control_ms,
        "last_tick_ts": time.time(),
        "player_color": player_color,
        "fen": fen,
        "game_ended": False,
        "ai_first_move_pending": player_color == "black",
        "player_first_move_pending": player_color == "white",
    }


def get_timer(game_id: uuid.UUID) -> dict | None:
    """Get current timer state. Returns None if game not registered."""
    return _game_timers.get(game_id)


def apply_elapsed(game_id: uuid.UUID) -> tuple[int, int] | None:
    """
    Apply elapsed time to current turn's clock. Update last_tick_ts.
    Returns (player_time_ms, ai_time_ms) after update, or None if game not found/ended.
    Skips ticking when ai_first_move_pending or player_first_move_pending.
    """
    t = _game_timers.get(game_id)
    if not t or t.get("game_ended"):
        return None
    if t.get("ai_first_move_pending") or t.get("player_first_move_pending"):
        t["last_tick_ts"] = time.time()
        return (t["player_time_ms"], t["ai_time_ms"])
    now = time.time()
    elapsed_ms = int((now - t["last_tick_ts"]) * 1000)
    t["last_tick_ts"] = now
    if elapsed_ms <= 0:
        return (t["player_time_ms"], t["ai_time_ms"])
    if is_player_turn(t["fen"], t["player_color"]):
        t["player_time_ms"] = max(0, t["player_time_ms"] - elapsed_ms)
    else:
        t["ai_time_ms"] = max(0, t["ai_time_ms"] - elapsed_ms)
    return (t["player_time_ms"], t["ai_time_ms"])


def update_fen(game_id: uuid.UUID, fen: str) -> None:
    """Update the FEN (and thus whose turn) for a game."""
    t = _game_timers.get(game_id)
    if t and not t.get("game_ended"):
        t["fen"] = fen


def clear_ai_first_move_pending(game_id: uuid.UUID) -> None:
    """Clear ai_first_move_pending after AI plays first move (player is black)."""
    t = _game_timers.get(game_id)
    if t:
        t["ai_first_move_pending"] = False


def clear_player_first_move_pending(game_id: uuid.UUID) -> None:
    """Clear player_first_move_pending after player makes first move (player is white)."""
    t = _game_timers.get(game_id)
    if t:
        t["player_first_move_pending"] = False


def remove_game(game_id: uuid.UUID) -> None:
    """Remove game from timer tracking (e.g. when game ends by checkmate)."""
    _game_timers.pop(game_id, None)


def mark_ended(game_id: uuid.UUID) -> None:
    """Mark game as ended (stops further ticks from affecting it)."""
    t = _game_timers.get(game_id)
    if t:
        t["game_ended"] = True


async def tick_all(broadcast_fn) -> None:
    """
    Tick all active games: apply elapsed time, check timeout, broadcast time_update.
    broadcast_fn(game_id, msg) sends msg to all subscribers of game_id.
    """
    now = time.time()
    to_remove: list[uuid.UUID] = []
    for game_id, t in list(_game_timers.items()):
        if t.get("game_ended"):
            to_remove.append(game_id)
            continue
        if t.get("ai_first_move_pending") or t.get("player_first_move_pending"):
            t["last_tick_ts"] = now
            await broadcast_fn(
                game_id,
                {
                    "type": "time_update",
                    "gameId": str(game_id),
                    "playerTimeMs": t["player_time_ms"],
                    "aiTimeMs": t["ai_time_ms"],
                },
            )
            continue
        elapsed_ms = int((now - t["last_tick_ts"]) * 1000)
        t["last_tick_ts"] = now
        if elapsed_ms > 0:
            if is_player_turn(t["fen"], t["player_color"]):
                t["player_time_ms"] = max(0, t["player_time_ms"] - elapsed_ms)
            else:
                t["ai_time_ms"] = max(0, t["ai_time_ms"] - elapsed_ms)
        pt = t["player_time_ms"]
        at = t["ai_time_ms"]
        if pt <= 0 or at <= 0:
            t["game_ended"] = True
            player_color = t["player_color"]
            result = "0-1" if pt <= 0 else "1-0"
            termination = "timeout"
            await moves_db.finalize_game_to_pgn(game_id, result, termination, player_color)
            await broadcast_fn(
                game_id,
                {
                    "type": "game_ended",
                    "gameId": str(game_id),
                    "result": result,
                    "termination": termination,
                },
            )
            to_remove.append(game_id)
        else:
            await broadcast_fn(
                game_id,
                {
                    "type": "time_update",
                    "gameId": str(game_id),
                    "playerTimeMs": pt,
                    "aiTimeMs": at,
                },
            )
    for gid in to_remove:
        _game_timers.pop(gid, None)
