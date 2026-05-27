"""Chess AI engine.

The engine keeps python-chess as the rules authority and layers a compact
classical search stack on top: iterative deepening, negamax alpha-beta,
quiescence search, transposition-table move reuse, killer/history ordering,
and a tapered handcrafted evaluation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Any

import chess

from opening_book import try_book_move

PIECE_TO_SYMBOL = {
    chess.PAWN: "p",
    chess.KNIGHT: "n",
    chess.BISHOP: "b",
    chess.ROOK: "r",
    chess.QUEEN: "q",
}


def _piece_to_symbol(piece: chess.Piece | None) -> str:
    """Map chess.Piece to lowercase symbol (p, n, b, r, q)."""
    if piece is None:
        return ""
    return PIECE_TO_SYMBOL.get(piece.piece_type, "")


PAWN_VALUE = 100
KNIGHT_VALUE = 320
BISHOP_VALUE = 330
ROOK_VALUE = 500
QUEEN_VALUE = 900
KING_VALUE = 20000

INFINITY = 1_000_000_000
MATE_SCORE = 100_000
MATE_BOUND = MATE_SCORE - 1_000
MAX_PHASE = 24
MAX_QUIESCENCE_DEPTH = 7
DEFAULT_SEARCH_DEPTH = 5
DEFAULT_SEARCH_TIME_LIMIT_SECONDS = 1.2

EXACT = "exact"
LOWER_BOUND = "lower"
UPPER_BOUND = "upper"

material_values = {
    chess.PAWN: PAWN_VALUE,
    chess.KNIGHT: KNIGHT_VALUE,
    chess.BISHOP: BISHOP_VALUE,
    chess.ROOK: ROOK_VALUE,
    chess.QUEEN: QUEEN_VALUE,
    chess.KING: KING_VALUE,
}

middlegame_values = {
    chess.PAWN: 100,
    chess.KNIGHT: 325,
    chess.BISHOP: 335,
    chess.ROOK: 500,
    chess.QUEEN: 940,
    chess.KING: 0,
}

endgame_values = {
    chess.PAWN: 125,
    chess.KNIGHT: 315,
    chess.BISHOP: 335,
    chess.ROOK: 520,
    chess.QUEEN: 930,
    chess.KING: 0,
}

phase_weights = {
    chess.KNIGHT: 1,
    chess.BISHOP: 1,
    chess.ROOK: 2,
    chess.QUEEN: 4,
}

pawn_table = [
     0,   0,   0,   0,   0,   0,   0,   0,
     5,  10,  10,   0,   0,  10,  10,   5,
    10,   5,   0,   5,   5,   0,   5,  10,
     0,   0,  15,  44,  44,  15,   0,   0,
     5,  10,  17,  37,  37,  17,  10,   5,
    18,  22,  32,  47,  47,  32,  22,  18,
    70,  70,  70,  70,  70,  70,  70,  70,
     0,   0,   0,   0,   0,   0,   0,   0
]

endgame_pawn_table = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5,  5,  5,-10,-10,  5,  5,  5,
     8,  8, 12, 16, 16, 12,  8,  8,
    12, 12, 18, 26, 26, 18, 12, 12,
    20, 20, 28, 38, 38, 28, 20, 20,
    38, 38, 48, 62, 62, 48, 38, 38,
    90, 90, 90, 90, 90, 90, 90, 90,
     0,  0,  0,  0,  0,  0,  0,  0
]

knight_table = [
    -25,-20,-15,-15,-15,-15,-20,-25,
    -20,-10,  0,  5,  5,  0,-10,-20,
    -15,  5, 10, 15, 15, 10,  5,-15,
    -15,  0, 15, 20, 20, 15,  0,-15,
    -15,  5, 15, 20, 20, 15,  5,-15,
    -15,  0, 10, 15, 15, 10,  0,-15,
    -20,-10,  0,  0,  0,  0,-10,-20,
    -25,-20,-15,-15,-15,-15,-20,-25
]

bishop_table = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
]

rook_table = [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  5,  5,  0,  0,  0
]

queen_table = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
]

king_table = [
    20, 30, 10,  0,  0, 10, 30, 20,
    20, 20,  0,  0,  0,  0, 20, 20,
   -10,-20,-20,-20,-20,-20,-20,-10,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30
]

endgame_king_table = [
   -50,-30,-20,-10,-10,-20,-30,-50,
   -30,-10, 10, 20, 20, 10,-10,-30,
   -20, 10, 25, 35, 35, 25, 10,-20,
   -10, 20, 35, 45, 45, 35, 20,-10,
   -10, 20, 35, 45, 45, 35, 20,-10,
   -20, 10, 25, 35, 35, 25, 10,-20,
   -30,-10, 10, 20, 20, 10,-10,-30,
   -50,-30,-20,-10,-10,-20,-30,-50
]

middlegame_piece_square_tables = {
    chess.PAWN: pawn_table,
    chess.KNIGHT: knight_table,
    chess.BISHOP: bishop_table,
    chess.ROOK: rook_table,
    chess.QUEEN: queen_table,
    chess.KING: king_table,
}

endgame_piece_square_tables = {
    chess.PAWN: endgame_pawn_table,
    chess.KNIGHT: knight_table,
    chess.BISHOP: bishop_table,
    chess.ROOK: rook_table,
    chess.QUEEN: queen_table,
    chess.KING: endgame_king_table,
}

# Backward-compatible name used by older tests/docs.
piece_square_tables = middlegame_piece_square_tables

PASSED_PAWN_BONUS = [0, 8, 18, 35, 65, 110, 190, 0]
CONNECTED_PAWN_BONUS = 10
DOUBLED_PAWN_PENALTY = 16
ISOLATED_PAWN_PENALTY = 12
BACKWARD_PAWN_PENALTY = 8
OPEN_FILE_ROOK_BONUS = 18
SEMI_OPEN_FILE_ROOK_BONUS = 9
ROOK_ON_SEVENTH_BONUS = 22
TEMPO_BONUS = 8
MOBILITY_WEIGHTS = {
    chess.KNIGHT: 4,
    chess.BISHOP: 4,
    chess.ROOK: 2,
    chess.QUEEN: 1,
}
OPENING_FULLMOVE_LIMIT = 12
DEVELOPED_MINOR_BONUS = 6
UNDEVELOPED_MINOR_PENALTY = 4
EARLY_QUEEN_MOVE_PENALTY = 20
EARLY_RIM_KNIGHT_PENALTY = 14
CASTLING_READY_BONUS = 12
CASTLED_KING_BONUS = 32
CENTER_PAWN_OPENING_BONUS = 28
CENTER_SQUARE_CONTROL_BONUS = 8
MINOR_STARTING_SQUARES = {
    chess.WHITE: (
        (chess.B1, chess.KNIGHT),
        (chess.G1, chess.KNIGHT),
        (chess.C1, chess.BISHOP),
        (chess.F1, chess.BISHOP),
    ),
    chess.BLACK: (
        (chess.B8, chess.KNIGHT),
        (chess.G8, chess.KNIGHT),
        (chess.C8, chess.BISHOP),
        (chess.F8, chess.BISHOP),
    ),
}
MINOR_STARTING_SQUARE_SET = {
    color: {square for square, _ in entries}
    for color, entries in MINOR_STARTING_SQUARES.items()
}
QUEEN_STARTING_SQUARES = {
    chess.WHITE: chess.D1,
    chess.BLACK: chess.D8,
}
CASTLED_KING_SQUARES = {
    chess.WHITE: (chess.G1, chess.C1),
    chess.BLACK: (chess.G8, chess.C8),
}
CENTER_PAWN_TARGETS = {
    chess.WHITE: (chess.D4, chess.E4),
    chess.BLACK: (chess.D5, chess.E5),
}
KINGSIDE_CASTLING_PATHS = {
    chess.WHITE: (chess.F1, chess.G1),
    chess.BLACK: (chess.F8, chess.G8),
}
QUEENSIDE_CASTLING_PATHS = {
    chess.WHITE: (chess.D1, chess.C1),
    chess.BLACK: (chess.D8, chess.C8),
}


@dataclass
class TranspositionEntry:
    depth: int
    score: int
    flag: str
    best_move: chess.Move | None


@dataclass
class SearchContext:
    deadline: float
    tt: dict[Any, TranspositionEntry] = field(default_factory=dict)
    killers: dict[int, list[chess.Move]] = field(default_factory=dict)
    history: dict[tuple[bool, int, int, int | None], int] = field(default_factory=dict)
    nodes: int = 0
    completed_depth: int = 0
    best_score: int = 0


class SearchTimeout(Exception):
    """Raised internally when iterative deepening exhausts its time budget."""


def _sign(color: chess.Color) -> int:
    return 1 if color == chess.WHITE else -1


def _table_index(square: chess.Square, color: chess.Color) -> chess.Square:
    return square if color == chess.WHITE else chess.square_mirror(square)


def _relative_rank(square: chess.Square, color: chess.Color) -> int:
    rank = chess.square_rank(square)
    return rank if color == chess.WHITE else 7 - rank


def _iter_file_squares(file_index: int) -> range:
    return range(file_index, 64, 8)


def _opening_weight(board_state: chess.Board) -> float:
    if board_state.fullmove_number > OPENING_FULLMOVE_LIMIT:
        return 0.0
    remaining = OPENING_FULLMOVE_LIMIT - board_state.fullmove_number + 1
    return remaining / OPENING_FULLMOVE_LIMIT


def _minor_development_counts(board_state: chess.Board, color: chess.Color) -> tuple[int, int]:
    undeveloped = 0
    for square, piece_type in MINOR_STARTING_SQUARES[color]:
        piece = board_state.piece_at(square)
        if piece and piece.color == color and piece.piece_type == piece_type:
            undeveloped += 1

    developed = 0
    starting_squares = MINOR_STARTING_SQUARE_SET[color]
    for piece_type in (chess.KNIGHT, chess.BISHOP):
        developed += sum(
            1
            for square in board_state.pieces(piece_type, color)
            if square not in starting_squares
        )
    return developed, undeveloped


def _castling_path_clear(board_state: chess.Board, color: chess.Color, kingside: bool) -> bool:
    path = KINGSIDE_CASTLING_PATHS[color] if kingside else QUEENSIDE_CASTLING_PATHS[color]
    return all(board_state.piece_at(square) is None for square in path)


def _opening_development_score(board_state: chess.Board) -> int:
    weight = _opening_weight(board_state)
    if weight <= 0:
        return 0

    score = 0
    for color in (chess.WHITE, chess.BLACK):
        sign = _sign(color)
        developed, undeveloped = _minor_development_counts(board_state, color)
        score += sign * (
            developed * DEVELOPED_MINOR_BONUS
            - undeveloped * UNDEVELOPED_MINOR_PENALTY
        )

        queen_start = QUEEN_STARTING_SQUARES[color]
        queen_at_home = (
            (piece := board_state.piece_at(queen_start))
            and piece.color == color
            and piece.piece_type == chess.QUEEN
        )
        if not queen_at_home and board_state.pieces(chess.QUEEN, color) and developed < 3:
            score -= sign * EARLY_QUEEN_MOVE_PENALTY * (3 - developed)

        king_square = board_state.king(color)
        if king_square in CASTLED_KING_SQUARES[color]:
            score += sign * CASTLED_KING_BONUS
        else:
            if board_state.has_kingside_castling_rights(color) and _castling_path_clear(
                board_state,
                color,
                kingside=True,
            ):
                score += sign * CASTLING_READY_BONUS
            if board_state.has_queenside_castling_rights(color) and _castling_path_clear(
                board_state,
                color,
                kingside=False,
            ):
                score += sign * CASTLING_READY_BONUS

        for square in CENTER_PAWN_TARGETS[color]:
            piece = board_state.piece_at(square)
            if piece and piece.color == color and piece.piece_type == chess.PAWN:
                enemy = not color
                enemy_pawns = board_state.pieces(chess.PAWN, enemy)
                pawn_hanging = bool(board_state.attackers(enemy, square) & enemy_pawns)
                bonus = CENTER_PAWN_OPENING_BONUS // 4 if pawn_hanging else CENTER_PAWN_OPENING_BONUS
                score += sign * bonus

        center_controlled = 0
        center_squares = (chess.D4, chess.E4, chess.D5, chess.E5)
        friendly_pawns = board_state.pieces(chess.PAWN, color)
        for center_sq in center_squares:
            if board_state.attackers(color, center_sq) & friendly_pawns:
                center_controlled += 1
        score += sign * center_controlled * CENTER_SQUARE_CONTROL_BONUS

        if developed < 3:
            for square in board_state.pieces(chess.KNIGHT, color):
                if chess.square_file(square) in (0, 7) and _relative_rank(square, color) >= 3:
                    score -= sign * EARLY_RIM_KNIGHT_PENALTY

    return int(score * weight)


def _position_key(board_state: chess.Board) -> Any:
    """Return a hashable key for transposition caching."""
    key_fn = getattr(board_state, "_transposition_key", None)
    if callable(key_fn):
        return key_fn(), board_state.halfmove_clock
    return (
        board_state.board_fen(),
        board_state.turn,
        board_state.castling_rights,
        board_state.ep_square,
        board_state.halfmove_clock,
    )


def _score_to_tt(score: int, ply: int) -> int:
    if score > MATE_BOUND:
        return score + ply
    if score < -MATE_BOUND:
        return score - ply
    return score


def _score_from_tt(score: int, ply: int) -> int:
    if score > MATE_BOUND:
        return score - ply
    if score < -MATE_BOUND:
        return score + ply
    return score


def _check_time(ctx: SearchContext) -> None:
    ctx.nodes += 1
    if ctx.nodes & 511 == 0 and time.perf_counter() >= ctx.deadline:
        raise SearchTimeout


def _terminal_score(board_state: chess.Board, ply: int) -> int | None:
    if board_state.is_checkmate():
        return -MATE_SCORE + ply
    if (
        board_state.is_stalemate()
        or board_state.is_insufficient_material()
        or board_state.is_seventyfive_moves()
        or board_state.is_fivefold_repetition()
    ):
        return 0
    return None


def _has_non_pawn_material(board_state: chess.Board, color: chess.Color) -> bool:
    return any(
        board_state.pieces(piece_type, color)
        for piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
    )


def _captured_piece(board_state: chess.Board, move: chess.Move) -> chess.Piece | None:
    if board_state.is_en_passant(move):
        offset = -8 if board_state.turn == chess.WHITE else 8
        return board_state.piece_at(move.to_square + offset)
    return board_state.piece_at(move.to_square)


def _captured_piece_symbol(board_state: chess.Board, move: chess.Move) -> str | None:
    captured_piece = _captured_piece(board_state, move)
    symbol = _piece_to_symbol(captured_piece)
    return symbol or None


def _is_passed_pawn(board_state: chess.Board, square: chess.Square, color: chess.Color) -> bool:
    enemy = not color
    file_index = chess.square_file(square)
    rank = chess.square_rank(square)
    files = range(max(0, file_index - 1), min(7, file_index + 1) + 1)
    enemy_pawns = board_state.pieces(chess.PAWN, enemy)

    for enemy_square in enemy_pawns:
        enemy_file = chess.square_file(enemy_square)
        if enemy_file not in files:
            continue
        enemy_rank = chess.square_rank(enemy_square)
        if color == chess.WHITE and enemy_rank > rank:
            return False
        if color == chess.BLACK and enemy_rank < rank:
            return False
    return True


def _is_connected_pawn(board_state: chess.Board, square: chess.Square, color: chess.Color) -> bool:
    file_index = chess.square_file(square)
    rank = chess.square_rank(square)
    friendly_pawns = board_state.pieces(chess.PAWN, color)
    for friendly_square in friendly_pawns:
        if friendly_square == square:
            continue
        file_delta = abs(chess.square_file(friendly_square) - file_index)
        rank_delta = abs(chess.square_rank(friendly_square) - rank)
        if file_delta == 1 and rank_delta <= 1:
            return True
    return False


def _pawn_structure_score(board_state: chess.Board) -> int:
    score = 0
    for color in (chess.WHITE, chess.BLACK):
        sign = _sign(color)
        pawn_squares = list(board_state.pieces(chess.PAWN, color))
        file_occurrences: dict[int, int] = {}
        for square in pawn_squares:
            file_index = chess.square_file(square)
            file_occurrences[file_index] = file_occurrences.get(file_index, 0) + 1

        for count in file_occurrences.values():
            if count > 1:
                score -= sign * DOUBLED_PAWN_PENALTY * (count - 1)

        for square in pawn_squares:
            file_index = chess.square_file(square)
            rank = _relative_rank(square, color)
            has_left_neighbor = (file_index - 1) in file_occurrences
            has_right_neighbor = (file_index + 1) in file_occurrences

            if not has_left_neighbor and not has_right_neighbor:
                score -= sign * ISOLATED_PAWN_PENALTY
            elif not _is_connected_pawn(board_state, square, color):
                score -= sign * BACKWARD_PAWN_PENALTY
            else:
                score += sign * CONNECTED_PAWN_BONUS

            if _is_passed_pawn(board_state, square, color):
                score += sign * PASSED_PAWN_BONUS[rank]
    return score


def _rook_activity_score(board_state: chess.Board) -> int:
    score = 0
    for color in (chess.WHITE, chess.BLACK):
        sign = _sign(color)
        rooks = board_state.pieces(chess.ROOK, color)
        for rook_square in rooks:
            file_index = chess.square_file(rook_square)
            friendly_pawns = 0
            enemy_pawns = 0
            for square in _iter_file_squares(file_index):
                piece = board_state.piece_at(square)
                if not piece or piece.piece_type != chess.PAWN:
                    continue
                if piece.color == color:
                    friendly_pawns += 1
                else:
                    enemy_pawns += 1
            if friendly_pawns == 0 and enemy_pawns == 0:
                score += sign * OPEN_FILE_ROOK_BONUS
            elif friendly_pawns == 0:
                score += sign * SEMI_OPEN_FILE_ROOK_BONUS

            relative_rank = _relative_rank(rook_square, color)
            if relative_rank == 6:
                score += sign * ROOK_ON_SEVENTH_BONUS
    return score


def _mobility_score(board_state: chess.Board) -> int:
    score = 0
    for square, piece in board_state.piece_map().items():
        weight = MOBILITY_WEIGHTS.get(piece.piece_type)
        if not weight:
            continue
        own_occupancy = board_state.occupied_co[piece.color]
        mobility = len(board_state.attacks(square) & ~own_occupancy)
        score += _sign(piece.color) * mobility * weight
    return score


def _king_safety_score(board_state: chess.Board) -> int:
    score = 0
    for color in (chess.WHITE, chess.BLACK):
        sign = _sign(color)
        king_square = board_state.king(color)
        if king_square is None:
            continue

        enemy = not color
        king_file = chess.square_file(king_square)
        king_rank = chess.square_rank(king_square)
        shield_rank = king_rank + (1 if color == chess.WHITE else -1)
        shield_files = range(max(0, king_file - 1), min(7, king_file + 1) + 1)

        shield = 0
        if 0 <= shield_rank <= 7:
            for file_index in shield_files:
                piece = board_state.piece_at(chess.square(file_index, shield_rank))
                if piece and piece.piece_type == chess.PAWN and piece.color == color:
                    shield += 1
        score += sign * shield * 10

        for file_index in shield_files:
            friendly_pawn_on_file = any(
                (piece := board_state.piece_at(square))
                and piece.piece_type == chess.PAWN
                and piece.color == color
                for square in _iter_file_squares(file_index)
            )
            enemy_rook_or_queen_on_file = any(
                (piece := board_state.piece_at(square))
                and piece.color == enemy
                and piece.piece_type in (chess.ROOK, chess.QUEEN)
                for square in _iter_file_squares(file_index)
            )
            if not friendly_pawn_on_file and enemy_rook_or_queen_on_file:
                score -= sign * 18

        attack_pressure = 0
        for square in chess.SquareSet(chess.BB_KING_ATTACKS[king_square]):
            attack_pressure += len(board_state.attackers(enemy, square))
        score -= sign * attack_pressure * 4
    return score


def _hanging_piece_score(board_state: chess.Board) -> int:
    score = 0
    for square, piece in board_state.piece_map().items():
        if piece.piece_type == chess.KING:
            continue
        enemy = not piece.color
        attackers = board_state.attackers(enemy, square)
        if not attackers:
            continue

        defenders = board_state.attackers(piece.color, square)
        piece_value = material_values[piece.piece_type]
        if not defenders:
            score -= _sign(piece.color) * int(piece_value * 0.12)
            continue

        least_attacker_value = min(
            material_values[board_state.piece_at(attacker).piece_type]
            for attacker in attackers
            if board_state.piece_at(attacker)
        )
        if least_attacker_value < piece_value:
            score -= _sign(piece.color) * int((piece_value - least_attacker_value) * 0.04)
    return score


def evaluate_board_state(board_state: chess.Board) -> int:
    """Evaluate the board from White's perspective in centipawns."""
    if board_state.is_checkmate():
        return -MATE_SCORE if board_state.turn == chess.WHITE else MATE_SCORE
    if (
        board_state.is_stalemate()
        or board_state.is_insufficient_material()
        or board_state.is_seventyfive_moves()
        or board_state.is_fivefold_repetition()
    ):
        return 0

    middlegame_score = 0
    endgame_score = 0
    phase = 0

    for square, piece in board_state.piece_map().items():
        sign = _sign(piece.color)
        piece_type = piece.piece_type
        table_index = _table_index(square, piece.color)
        middlegame_score += sign * (
            middlegame_values[piece_type]
            + middlegame_piece_square_tables[piece_type][table_index]
        )
        endgame_score += sign * (
            endgame_values[piece_type]
            + endgame_piece_square_tables[piece_type][table_index]
        )
        phase += phase_weights.get(piece_type, 0)

    if len(board_state.pieces(chess.BISHOP, chess.WHITE)) >= 2:
        middlegame_score += 35
        endgame_score += 45
    if len(board_state.pieces(chess.BISHOP, chess.BLACK)) >= 2:
        middlegame_score -= 35
        endgame_score -= 45

    pawn_score = _pawn_structure_score(board_state)
    rook_score = _rook_activity_score(board_state)
    mobility_score = _mobility_score(board_state)
    hanging_score = _hanging_piece_score(board_state)

    middlegame_score += pawn_score + rook_score + mobility_score + hanging_score
    endgame_score += pawn_score + rook_score + int(mobility_score * 0.6) + hanging_score
    middlegame_score += _king_safety_score(board_state)
    middlegame_score += _opening_development_score(board_state)
    endgame_score += TEMPO_BONUS if board_state.turn == chess.WHITE else -TEMPO_BONUS

    phase = min(MAX_PHASE, phase)
    blended = (
        middlegame_score * phase
        + endgame_score * (MAX_PHASE - phase)
    ) / MAX_PHASE
    return int(blended)


def _evaluate_for_side_to_move(board_state: chess.Board) -> int:
    score = evaluate_board_state(board_state)
    return score if board_state.turn == chess.WHITE else -score


def _history_key(board_state: chess.Board, move: chess.Move) -> tuple[bool, int, int, int | None]:
    return board_state.turn, move.from_square, move.to_square, move.promotion


def _remember_killer(ctx: SearchContext, ply: int, move: chess.Move) -> None:
    killers = ctx.killers.setdefault(ply, [])
    if move in killers:
        return
    killers.insert(0, move)
    del killers[2:]


def _move_order_score(
    board_state: chess.Board,
    move: chess.Move,
    ctx: SearchContext,
    ply: int,
    tt_move: chess.Move | None,
) -> int:
    if tt_move and move == tt_move:
        return 10_000_000

    score = 0
    moving_piece = board_state.piece_at(move.from_square)

    if board_state.is_capture(move):
        captured_piece = _captured_piece(board_state, move)
        victim_value = material_values[captured_piece.piece_type] if captured_piece else PAWN_VALUE
        attacker_value = material_values[moving_piece.piece_type] if moving_piece else PAWN_VALUE
        score += 1_000_000 + victim_value * 16 - attacker_value
    else:
        killers = ctx.killers.get(ply, [])
        if killers and move == killers[0]:
            score += 900_000
        elif len(killers) > 1 and move == killers[1]:
            score += 800_000
        score += ctx.history.get(_history_key(board_state, move), 0)

    if move.promotion:
        score += 700_000 + material_values[move.promotion]

    if board_state.gives_check(move):
        score += 60_000

    if moving_piece and moving_piece.piece_type == chess.KING and abs(move.to_square - move.from_square) == 2:
        score += 15_000

    return score


def _ordered_moves(
    board_state: chess.Board,
    ctx: SearchContext,
    ply: int,
    tt_move: chess.Move | None = None,
    tactical_only: bool = False,
    include_checks: bool = False,
) -> list[chess.Move]:
    if tactical_only:
        moves = [
            move for move in board_state.legal_moves
            if board_state.is_capture(move)
            or move.promotion
            or (include_checks and board_state.gives_check(move))
        ]
    else:
        moves = list(board_state.legal_moves)

    moves.sort(
        key=lambda move: _move_order_score(board_state, move, ctx, ply, tt_move),
        reverse=True,
    )
    return moves


def _quiescence(
    board_state: chess.Board,
    alpha: int,
    beta: int,
    ply: int,
    ctx: SearchContext,
    q_depth: int = 0,
) -> int:
    _check_time(ctx)

    terminal = _terminal_score(board_state, ply)
    if terminal is not None:
        return terminal

    in_check = board_state.is_check()
    stand_pat = None
    if not in_check:
        stand_pat = _evaluate_for_side_to_move(board_state)
        if stand_pat >= beta:
            return beta
        if stand_pat > alpha:
            alpha = stand_pat
        if q_depth >= MAX_QUIESCENCE_DEPTH:
            return alpha

    moves = (
        _ordered_moves(
            board_state,
            ctx,
            ply,
            tactical_only=True,
            include_checks=q_depth < 2,
        )
        if not in_check
        else _ordered_moves(board_state, ctx, ply)
    )

    for move in moves:
        if not in_check and not move.promotion and board_state.is_capture(move):
            captured_piece = _captured_piece(board_state, move)
            captured_value = material_values[captured_piece.piece_type] if captured_piece else PAWN_VALUE
            if stand_pat is not None and stand_pat + captured_value + 120 < alpha:
                continue

        board_state.push(move)
        try:
            score = -_quiescence(board_state, -beta, -alpha, ply + 1, ctx, q_depth + 1)
        finally:
            board_state.pop()

        if score >= beta:
            return beta
        if score > alpha:
            alpha = score

    return alpha


def _negamax(
    board_state: chess.Board,
    depth: int,
    alpha: int,
    beta: int,
    ply: int,
    ctx: SearchContext,
    allow_null_move: bool = True,
) -> int:
    _check_time(ctx)

    terminal = _terminal_score(board_state, ply)
    if terminal is not None:
        return terminal
    if depth <= 0:
        return _quiescence(board_state, alpha, beta, ply, ctx)

    alpha_original = alpha
    beta_original = beta
    key = _position_key(board_state)
    entry = ctx.tt.get(key)
    tt_move = entry.best_move if entry else None

    if entry and entry.depth >= depth:
        tt_score = _score_from_tt(entry.score, ply)
        if entry.flag == EXACT:
            return tt_score
        if entry.flag == LOWER_BOUND:
            alpha = max(alpha, tt_score)
        elif entry.flag == UPPER_BOUND:
            beta = min(beta, tt_score)
        if alpha >= beta:
            return tt_score

    in_check = board_state.is_check()
    if (
        allow_null_move
        and depth >= 3
        and not in_check
        and _has_non_pawn_material(board_state, board_state.turn)
    ):
        reduction = 3 if depth >= 5 else 2
        board_state.push(chess.Move.null())
        try:
            null_score = -_negamax(
                board_state,
                depth - 1 - reduction,
                -beta,
                -beta + 1,
                ply + 1,
                ctx,
                allow_null_move=False,
            )
        finally:
            board_state.pop()
        if null_score >= beta:
            return beta

    best_score = -INFINITY
    best_move = None
    moves = _ordered_moves(board_state, ctx, ply, tt_move)

    for move_index, move in enumerate(moves):
        is_quiet = not board_state.is_capture(move) and not move.promotion
        gives_check = board_state.gives_check(move)
        extension = 1 if gives_check and depth <= 2 else 0
        next_depth = depth - 1 + extension

        board_state.push(move)
        try:
            if move_index == 0:
                score = -_negamax(board_state, next_depth, -beta, -alpha, ply + 1, ctx)
            else:
                reduction = 0
                if (
                    is_quiet
                    and not in_check
                    and not gives_check
                    and depth >= 3
                    and move_index >= 4
                ):
                    reduction = 1 + int(depth >= 5 and move_index >= 10)

                reduced_depth = max(0, next_depth - reduction)
                score = -_negamax(
                    board_state,
                    reduced_depth,
                    -alpha - 1,
                    -alpha,
                    ply + 1,
                    ctx,
                )
                if reduction and score > alpha:
                    score = -_negamax(
                        board_state,
                        next_depth,
                        -alpha - 1,
                        -alpha,
                        ply + 1,
                        ctx,
                    )
                if alpha < score < beta:
                    score = -_negamax(board_state, next_depth, -beta, -alpha, ply + 1, ctx)
        finally:
            board_state.pop()

        if score > best_score:
            best_score = score
            best_move = move
        if score > alpha:
            alpha = score
        if alpha >= beta:
            if is_quiet:
                _remember_killer(ctx, ply, move)
                key_for_history = _history_key(board_state, move)
                ctx.history[key_for_history] = ctx.history.get(key_for_history, 0) + depth * depth
            break

    if best_move is None:
        return _terminal_score(board_state, ply) or 0

    if best_score <= alpha_original:
        flag = UPPER_BOUND
    elif best_score >= beta_original:
        flag = LOWER_BOUND
    else:
        flag = EXACT

    ctx.tt[key] = TranspositionEntry(
        depth=depth,
        score=_score_to_tt(best_score, ply),
        flag=flag,
        best_move=best_move,
    )
    return best_score


def _search_root(
    board_state: chess.Board,
    depth: int,
    ctx: SearchContext,
    previous_best: chess.Move | None,
) -> tuple[int, chess.Move | None]:
    best_score = -INFINITY
    best_move = None
    alpha = -INFINITY
    beta = INFINITY

    moves = _ordered_moves(board_state, ctx, 0, previous_best)
    for move in moves:
        board_state.push(move)
        try:
            score = -_negamax(board_state, depth - 1, -beta, -alpha, 1, ctx)
        finally:
            board_state.pop()

        if score > best_score:
            best_score = score
            best_move = move
        if score > alpha:
            alpha = score

    return best_score, best_move


def select_best_move(
    board_state: chess.Board,
    depth: int = DEFAULT_SEARCH_DEPTH,
    time_limit: float = DEFAULT_SEARCH_TIME_LIMIT_SECONDS,
) -> chess.Move | None:
    """Select the strongest move found before depth/time limits are exhausted."""
    legal_moves = list(board_state.legal_moves)
    if not legal_moves:
        return None
    if len(legal_moves) == 1:
        return legal_moves[0]

    # Opening book: pick a random book move during the first 4 moves
    book_move = try_book_move(board_state)
    if book_move is not None and book_move in legal_moves:
        board_state.gambitron_last_search = {
            "depth": 0,
            "nodes": 0,
            "score": 0,
            "tt_entries": 0,
            "book": True,
        }
        return book_move

    max_depth = max(1, depth)
    deadline = time.perf_counter() + max(0.01, time_limit)
    ctx = SearchContext(deadline=deadline)

    best_move: chess.Move | None = legal_moves[0]
    best_score = -INFINITY

    for current_depth in range(1, max_depth + 1):
        try:
            score, move = _search_root(board_state, current_depth, ctx, best_move)
        except SearchTimeout:
            break
        if move is not None:
            best_move = move
            best_score = score
            ctx.completed_depth = current_depth
            ctx.best_score = score

    # Store useful diagnostics for callers that want them without changing
    # the public return type.
    board_state.gambitron_last_search = {
        "depth": ctx.completed_depth,
        "nodes": ctx.nodes,
        "score": best_score,
        "tt_entries": len(ctx.tt),
    }
    return best_move


def minimax(
    board_state: chess.Board,
    depth: int,
    alpha: float,
    beta: float,
    is_maximizing: bool,
) -> float:
    """Compatibility wrapper around the negamax search.

    Returns a White-perspective score like the old implementation did.
    """
    del is_maximizing
    ctx = SearchContext(deadline=time.perf_counter() + DEFAULT_SEARCH_TIME_LIMIT_SECONDS)
    alpha_bound = -INFINITY if alpha == float("-inf") else int(alpha)
    beta_bound = INFINITY if beta == float("inf") else int(beta)
    score = _negamax(board_state, depth, alpha_bound, beta_bound, 0, ctx)
    return score if board_state.turn == chess.WHITE else -score


def get_best_move(
    fen_str: str,
    depth: int = DEFAULT_SEARCH_DEPTH,
    time_limit: float = DEFAULT_SEARCH_TIME_LIMIT_SECONDS,
):
    try:
        board_state = chess.Board(fen_str)
    except ValueError as e:
        raise ValueError("Invalid FEN string.") from e
    if board_state.is_game_over():
        return {
            "updated_fen": board_state.fen(),
            "result": board_state.result(),
            "san": None,
            "from_square": None,
            "to_square": None,
            "captured": None,
        }

    chosen_move = select_best_move(board_state, depth=depth, time_limit=time_limit)
    if chosen_move is None:
        raise ValueError("No valid moves found.")

    san = board_state.san(chosen_move)
    from_square = chess.square_name(chosen_move.from_square)
    to_square = chess.square_name(chosen_move.to_square)
    captured = _captured_piece_symbol(board_state, chosen_move)
    search_info = getattr(board_state, "gambitron_last_search", {})

    board_state.push(chosen_move)
    return {
        "updated_fen": board_state.fen(),
        "result": board_state.result(),
        "san": san,
        "from_square": from_square,
        "to_square": to_square,
        "captured": captured,
        "search": search_info,
    }
