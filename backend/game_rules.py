"""Chess game rules checking (draw conditions, etc)."""
from typing import Optional

import chess


def _position_state_from_fen(fen: str) -> Optional[str]:
    """Return the FEN fields that define a repeatable chess position."""
    parts = fen.split()
    if len(parts) >= 4:
        return " ".join(parts[:4])
    return None


def check_3_move_repetition(
    moves: list[dict],
    initial_fen: Optional[str] = chess.STARTING_FEN,
) -> bool:
    """Check if the current position has occurred 3 times in the game.

    Looks at the board state (position without move counters) from the FEN.
    Returns True if the current position has repeated 3+ times.
    """
    if len(moves) < 4:  # Need at least 4 moves to have a position repeat
        return False

    # Extract the board state portion of each FEN (everything except halfmove and fullmove clocks)
    position_states = []
    if initial_fen:
        initial_position_state = _position_state_from_fen(initial_fen)
        if initial_position_state:
            position_states.append(initial_position_state)

    for move in moves:
        fen = move["fen"]
        # Extract just the position part: "rnbq... w KQkq - 0 1" -> "rnbq... w KQkq -"
        position_state = _position_state_from_fen(fen)
        if position_state:
            # Position state is: board + active color + castling + en passant
            position_states.append(position_state)

    # Check if the latest position (current board state) has appeared 3 times
    if position_states:
        current_position = position_states[-1]
        count = position_states.count(current_position)
        return count >= 3

    return False
