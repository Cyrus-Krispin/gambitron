"""Tests for persisted move reconstruction."""
import importlib
import sys
import types


def test_pgn_to_moves_records_en_passant_capture():
    """Test that replay metadata includes the pawn captured en passant."""
    sys.modules["db.games"] = types.SimpleNamespace()
    moves_module = importlib.import_module("db.moves")

    _pgn_to_moves_list = moves_module._pgn_to_moves_list
    moves = _pgn_to_moves_list("1. e4 h5 2. e5 d5 3. exd6")

    assert moves[-1]["san"] == "exd6"
    assert moves[-1]["from_square"] == "e5"
    assert moves[-1]["to_square"] == "d6"
    assert moves[-1]["captured"] == "p"
