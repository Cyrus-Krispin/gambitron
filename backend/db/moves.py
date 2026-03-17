"""Move storage: in-memory during game, PGN on disk and in DB when game ends."""
import io
import os
import uuid

import chess
import chess.pgn

from config import PGN_STORAGE_DIR
from db import games as games_db

# In-memory storage for active games (cleared when game ends)
_memory_moves: dict[uuid.UUID, list[dict]] = {}

PIECE_TO_SYMBOL = {
    chess.PAWN: "p",
    chess.KNIGHT: "n",
    chess.BISHOP: "b",
    chess.ROOK: "r",
    chess.QUEEN: "q",
}


def _ensure_pgn_dir() -> None:
    """Create PGN storage directory if it doesn't exist."""
    path = PGN_STORAGE_DIR
    if path:
        os.makedirs(path, exist_ok=True)


def _build_uci(san: str, from_square: str | None, to_square: str | None) -> str:
    """Build UCI string from SAN and squares. Handles promotion (e7e8=Q -> e7e8q)."""
    if from_square and to_square:
        if "=" in san:
            promo = san.split("=")[-1].strip().lower()[0]
            return f"{from_square}{to_square}{promo}"
        return f"{from_square}{to_square}"
    return ""


async def append_move(
    game_id: uuid.UUID,
    ply: int,
    fen: str,
    san: str,
    from_square: str | None = None,
    to_square: str | None = None,
    captured: str | None = None,
) -> bool:
    """Append a move to in-memory storage. Returns True."""
    if game_id not in _memory_moves:
        _memory_moves[game_id] = []
    _memory_moves[game_id].append(
        {
            "ply": ply,
            "fen": fen,
            "san": san,
            "from_square": from_square,
            "to_square": to_square,
            "captured": captured,
        }
    )
    return True


async def get_move_count(game_id: uuid.UUID) -> int:
    """Get the number of moves for a game (for next ply)."""
    return len(_memory_moves.get(game_id, []))


def _pgn_to_moves_list(pgn: str) -> list[dict]:
    """Parse PGN string to list of move dicts (ply, fen, san, from_square, to_square, captured)."""
    if not pgn or not pgn.strip():
        return []
    try:
        game = chess.pgn.read_game(io.StringIO(pgn))
        if not game:
            return []
        board = game.board()
        moves_list: list[dict] = []
        for ply, move in enumerate(game.mainline_moves(), start=1):
            san = board.san(move)
            from_sq = chess.square_name(move.from_square)
            to_sq = chess.square_name(move.to_square)
            captured = None
            if board.is_capture(move):
                piece = board.piece_at(move.to_square)
                if piece:
                    captured = PIECE_TO_SYMBOL.get(piece.piece_type)
            board.push(move)
            moves_list.append(
                {
                    "ply": ply,
                    "fen": board.fen(),
                    "san": san,
                    "from_square": from_sq,
                    "to_square": to_sq,
                    "captured": captured,
                }
            )
        return moves_list
    except Exception:
        return []


async def get_moves_by_game(game_id: uuid.UUID) -> list[dict]:
    """Get all moves for a game, ordered by ply. From memory if active, else from games.pgn."""
    if game_id in _memory_moves:
        moves = _memory_moves[game_id]
        return sorted(moves, key=lambda m: m["ply"])
    game = await games_db.get_game(game_id)
    if not game or not game.get("pgn"):
        return []
    return _pgn_to_moves_list(game["pgn"])


async def finalize_game_to_pgn(
    game_id: uuid.UUID,
    result: str,
    termination: str,
    player_color: str = "white",
) -> bool:
    """Build PGN from in-memory moves, write to file, update games.pgn, clear memory."""
    moves = _memory_moves.get(game_id, [])
    if not moves:
        await games_db.update_game_ended(game_id, result, termination, pgn=None)
        if game_id in _memory_moves:
            del _memory_moves[game_id]
        return True

    game = chess.pgn.Game()
    game.headers["Event"] = "Gambitron"
    game.headers["White"] = "Human" if player_color == "white" else "AI"
    game.headers["Black"] = "AI" if player_color == "white" else "Human"
    game.headers["Result"] = result

    board = game.board()
    node = game
    for m in sorted(moves, key=lambda x: x["ply"]):
        uci = _build_uci(m["san"], m.get("from_square"), m.get("to_square"))
        if uci:
            move = chess.Move.from_uci(uci)
        else:
            move = board.parse_san(m["san"])
        node = node.add_variation(move)
        board.push(move)

    pgn_str = str(game)

    if PGN_STORAGE_DIR:
        _ensure_pgn_dir()
        path = os.path.join(PGN_STORAGE_DIR, f"{game_id}.pgn")
        with open(path, "w") as f:
            f.write(pgn_str)
            f.write("\n\n")

    await games_db.update_game_ended(game_id, result, termination, pgn=pgn_str)
    del _memory_moves[game_id]
    return True
