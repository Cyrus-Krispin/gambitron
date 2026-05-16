"""Tests for WebSocket game message handlers."""
import asyncio
import importlib
import sys
import types
import uuid

import chess
import pytest


@pytest.fixture(autouse=True)
def cleanup_handler_modules():
    yield
    for module_name in ("websocket.handlers", "websocket.timers", "db.games", "db.moves"):
        sys.modules.pop(module_name, None)
    websocket_module = sys.modules.get("websocket")
    if websocket_module:
        for attr in ("handlers", "timers"):
            if hasattr(websocket_module, attr):
                delattr(websocket_module, attr)
    db_module = sys.modules.get("db")
    if db_module:
        for attr in ("games", "moves"):
            if hasattr(db_module, attr):
                delattr(db_module, attr)


def _load_handlers(monkeypatch):
    """Load handlers with DB modules stubbed for pure handler tests."""
    for module_name in ("websocket.handlers", "websocket.timers", "db.games", "db.moves"):
        sys.modules.pop(module_name, None)
    websocket_module = sys.modules.get("websocket")
    if websocket_module:
        for attr in ("handlers", "timers"):
            if hasattr(websocket_module, attr):
                delattr(websocket_module, attr)
    db_module = sys.modules.get("db")
    if db_module:
        for attr in ("games", "moves"):
            if hasattr(db_module, attr):
                delattr(db_module, attr)

    games: dict[uuid.UUID, dict] = {}
    appended_moves: list[dict] = []
    timers_state: dict[uuid.UUID, dict] = {}

    async def get_game(game_id):
        return games.get(game_id)

    async def get_move_count(game_id):
        return len([move for move in appended_moves if move["game_id"] == game_id])

    async def append_move(game_id, ply, fen, san, from_square=None, to_square=None, captured=None):
        appended_moves.append(
            {
                "game_id": game_id,
                "ply": ply,
                "fen": fen,
                "san": san,
                "from_square": from_square,
                "to_square": to_square,
                "captured": captured,
            }
        )
        return True

    async def get_moves_by_game(game_id):
        return [
            {key: value for key, value in move.items() if key != "game_id"}
            for move in appended_moves
            if move["game_id"] == game_id
        ]

    async def finalize_game_to_pgn(*args, **kwargs):
        return True

    monkeypatch.setitem(sys.modules, "db.games", types.SimpleNamespace(get_game=get_game))
    monkeypatch.setitem(
        sys.modules,
        "db.moves",
        types.SimpleNamespace(
            get_move_count=get_move_count,
            append_move=append_move,
            get_moves_by_game=get_moves_by_game,
            finalize_game_to_pgn=finalize_game_to_pgn,
        ),
    )

    def is_player_turn(fen, player_color):
        board = chess.Board(fen)
        return (player_color == "white") == (board.turn == chess.WHITE)

    def register_game(game_id, time_control_ms, player_color, fen, increment_ms=0):
        timers_state[game_id] = {
            "player_time_ms": time_control_ms,
            "ai_time_ms": time_control_ms,
            "increment_ms": increment_ms,
            "player_color": player_color,
            "fen": fen,
            "game_ended": False,
            "player_first_move_pending": player_color == "white",
        }

    def get_timer(game_id):
        return timers_state.get(game_id)

    def apply_elapsed(game_id):
        timer = timers_state.get(game_id)
        if not timer:
            return None
        return timer["player_time_ms"], timer["ai_time_ms"]

    def update_fen(game_id, fen):
        timers_state[game_id]["fen"] = fen

    def clear_player_first_move_pending(game_id):
        timers_state[game_id]["player_first_move_pending"] = False

    def add_player_increment(game_id):
        timer = timers_state.get(game_id)
        if timer:
            timer["player_time_ms"] += timer.get("increment_ms", 0)
        return timer["player_time_ms"], timer["ai_time_ms"]

    def add_ai_increment(game_id):
        timer = timers_state.get(game_id)
        if timer:
            timer["ai_time_ms"] += timer.get("increment_ms", 0)
        return timer["player_time_ms"], timer["ai_time_ms"]

    def mark_ended(game_id):
        timers_state[game_id]["game_ended"] = True

    def remove_game(game_id):
        timers_state.pop(game_id, None)

    fake_timers = types.SimpleNamespace(
        _game_timers=timers_state,
        is_player_turn=is_player_turn,
        register_game=register_game,
        get_timer=get_timer,
        apply_elapsed=apply_elapsed,
        update_fen=update_fen,
        clear_player_first_move_pending=clear_player_first_move_pending,
        add_player_increment=add_player_increment,
        add_ai_increment=add_ai_increment,
        mark_ended=mark_ended,
        remove_game=remove_game,
    )
    monkeypatch.setitem(sys.modules, "websocket.timers", fake_timers)

    handlers = importlib.import_module("websocket.handlers")
    return handlers, fake_timers, games, appended_moves


def test_handle_player_move_rejects_illegal_client_transition(monkeypatch):
    """A client cannot advance from the server FEN with an illegal move."""
    handlers, timers, games, appended_moves = _load_handlers(monkeypatch)
    game_id = uuid.uuid4()
    games[game_id] = {"player_color": "white", "ended_at": None}
    timers.register_game(game_id, 60_000, "white", chess.STARTING_FEN)

    async def fail_ai(_fen):
        raise AssertionError("AI should not run for an illegal player move")

    monkeypatch.setattr(handlers, "_run_ai", fail_ai)

    result = asyncio.run(
        handlers.handle_player_move(
            object(),
            {
                "gameId": str(game_id),
                "fen": "rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                "from": "e2",
                "to": "e5",
            },
        )
    )

    assert result == {"type": "error", "message": "Illegal move"}
    assert appended_moves == []
    assert timers.get_timer(game_id)["fen"] == chess.STARTING_FEN


def test_handle_player_move_records_valid_move_from_server_board(monkeypatch):
    """Valid moves are canonicalized from the server board before storage."""
    handlers, timers, games, appended_moves = _load_handlers(monkeypatch)
    game_id = uuid.uuid4()
    games[game_id] = {"player_color": "white", "ended_at": None}
    timers.register_game(game_id, 60_000, "white", chess.STARTING_FEN)

    player_board = chess.Board()
    player_board.push(chess.Move.from_uci("e2e4"))

    async def fake_ai(fen):
        ai_board = chess.Board(fen)
        ai_move = chess.Move.from_uci("e7e5")
        ai_san = ai_board.san(ai_move)
        ai_board.push(ai_move)
        return {
            "updated_fen": ai_board.fen(),
            "result": ai_board.result(),
            "san": ai_san,
            "from_square": "e7",
            "to_square": "e5",
            "captured": None,
        }

    monkeypatch.setattr(handlers, "_run_ai", fake_ai)

    result = asyncio.run(
        handlers.handle_player_move(
            object(),
            {
                "gameId": str(game_id),
                "fen": player_board.fen(),
                "san": "not trusted",
                "from": "e2",
                "to": "e4",
                "captured": "q",
            },
        )
    )

    assert result["type"] == "ai_move"
    assert appended_moves[0]["san"] == "e4"
    assert appended_moves[0]["from_square"] == "e2"
    assert appended_moves[0]["to_square"] == "e4"
    assert appended_moves[0]["captured"] is None
