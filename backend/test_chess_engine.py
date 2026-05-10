"""Regression tests for the Gambitron chess engine."""
import chess

from chess_engine import (
    _captured_piece_symbol,
    _opening_development_score,
    evaluate_board_state,
    get_best_move,
    middlegame_piece_square_tables,
    select_best_move,
)


def test_engine_finds_mate_in_one():
    """The search should prefer immediate mate over material moves."""
    result = get_best_move(
        "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
        depth=3,
        time_limit=0.5,
    )

    assert result["san"] == "Qf8#"
    assert result["result"] == "1-0"


def test_engine_promotes_to_mating_queen():
    """Promotion ordering should consider queen promotion and mate scores."""
    result = get_best_move(
        "7k/P7/7K/8/8/8/8/8 w - - 0 1",
        depth=3,
        time_limit=0.5,
    )

    assert result["san"] == "a8=Q#"
    assert result["result"] == "1-0"


def test_en_passant_capture_metadata():
    """En passant captures land on an empty square but still capture a pawn."""
    board = chess.Board("8/8/8/3pP3/8/8/8/4K2k w - d6 0 1")
    move = chess.Move.from_uci("e5d6")

    assert board.is_en_passant(move)
    assert _captured_piece_symbol(board, move) == "p"

    result = get_best_move(board.fen(), depth=3, time_limit=0.5)
    assert result["san"] == "exd6"
    assert result["captured"] == "p"


def test_select_best_move_does_not_mutate_board():
    """Search uses push/pop internally and must leave the caller's board intact."""
    board = chess.Board()
    before = board.fen()

    move = select_best_move(board, depth=3, time_limit=0.5)

    assert move in chess.Board(before).legal_moves
    assert board.fen() == before


def test_timeout_during_quiescence_does_not_corrupt_board():
    """The d4 Nf6 Nc3 line previously left the board on a deep search branch."""
    fen = "rnbqkb1r/pppppppp/5n2/8/3P4/2N5/PPP1PPPP/R1BQKBNR b KQkq - 1 2"
    board = chess.Board(fen)

    move = select_best_move(board, depth=5, time_limit=0.01)

    assert move in chess.Board(fen).legal_moves
    assert board.fen() == fen


def test_engine_handles_d4_nf6_nc3_position():
    """Regression for the frontend getting stuck after 1. d4 Nf6 2. Nc3."""
    result = get_best_move(
        "rnbqkb1r/pppppppp/5n2/8/3P4/2N5/PPP1PPPP/R1BQKBNR b KQkq - 1 2",
        depth=5,
        time_limit=0.5,
    )

    assert result["san"]
    assert result["from_square"]
    assert result["to_square"]
    assert result["result"] == "*"


def test_start_position_evaluates_near_equal():
    """The starting position should not contain a baked-in color bias."""
    assert abs(evaluate_board_state(chess.Board())) <= 10


def test_middlegame_king_table_rewards_safe_home_squares():
    """Regression for issue #14: middlegame king PST must not reward exposure."""
    king_table = middlegame_piece_square_tables[chess.KING]

    assert king_table[chess.G1] > king_table[chess.E4]
    assert king_table[chess.G1] > king_table[chess.E8]
    assert king_table[chess.C1] > king_table[chess.E4]


def test_opening_development_rewards_minor_piece_development():
    """Opening eval should nudge natural development without becoming material."""
    start = chess.Board()
    developed = chess.Board(
        "rnbqkbnr/pppppppp/8/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq - 0 3"
    )

    assert _opening_development_score(developed) > _opening_development_score(start) + 15


def test_opening_development_penalizes_early_rim_knight_attack():
    """A second knight move to the rim should need a real tactical reason early."""
    developed_knight = chess.Board(
        "rnbqkb1r/pppppppp/5n2/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 2 2"
    )
    rim_knight = chess.Board(
        "rnbqkb1r/pppppppp/8/7n/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 2 2"
    )

    assert _opening_development_score(rim_knight) > _opening_development_score(developed_knight)


def test_opening_development_fades_when_material_is_imbalanced():
    """Development should not make the engine ignore a real material advantage."""
    imbalanced = chess.Board(
        "rnb1kbnr/pppppppp/8/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq - 0 3"
    )

    assert _opening_development_score(imbalanced) == 0
