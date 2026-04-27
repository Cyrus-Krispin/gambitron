"""Tests for game rules checking."""
import pytest
from game_rules import check_3_move_repetition


def test_no_repetition():
    """Test that game with no repeated positions returns False."""
    moves = [
        {"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
        {"fen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2"},
    ]
    assert check_3_move_repetition(moves) is False


def test_single_repetition():
    """Test that a position occurring twice returns False."""
    initial_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    moves = [
        {"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
        {"fen": initial_fen},  # Back to starting position
    ]
    assert check_3_move_repetition(moves) is False


def test_triple_repetition():
    """Test that a position occurring 3 times returns True."""
    initial_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    other_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    moves = [
        {"fen": other_fen},
        {"fen": initial_fen},  # 1st time
        {"fen": other_fen},
        {"fen": initial_fen},  # 2nd time
        {"fen": other_fen},
        {"fen": initial_fen},  # 3rd time
    ]
    assert check_3_move_repetition(moves) is True


def test_less_than_4_moves():
    """Test that games with fewer than 4 moves return False."""
    moves = [
        {"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
    ]
    assert check_3_move_repetition(moves) is False


def test_position_with_different_halfmove_clocks():
    """Test that positions are compared ignoring halfmove and fullmove clocks."""
    # Same position, different move counters
    fen_1 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    fen_2 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 10"

    moves = [
        {"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
        {"fen": fen_1},
        {"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 5 5"},
        {"fen": fen_2},  # Same position as fen_1
        {"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 10 10"},
        {"fen": fen_1},  # Third occurrence
    ]
    assert check_3_move_repetition(moves) is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
