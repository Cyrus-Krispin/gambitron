"""Regression tests for server-authoritative clock increments."""
import asyncio
import uuid

from websocket import handlers
from websocket import timers as timers_module


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"


def setup_function():
    timers_module._game_timers.clear()


def teardown_function():
    timers_module._game_timers.clear()


def test_add_player_increment_uses_registered_increment():
    game_id = uuid.uuid4()

    timers_module.register_game(game_id, 120_000, "white", START_FEN, increment_ms=1_000)
    timers_module.add_player_increment(game_id)

    timer = timers_module.get_timer(game_id)
    assert timer is not None
    assert timer["player_time_ms"] == 121_000
    assert timer["ai_time_ms"] == 120_000


def test_start_game_registers_increment(monkeypatch):
    game_id = uuid.uuid4()

    async def fake_create_game(time_control_ms: int, player_color: str, increment_ms: int = 0):
        assert time_control_ms == 180_000
        assert player_color == "white"
        assert increment_ms == 2_000
        return game_id

    monkeypatch.setattr(handlers.games_db, "create_game", fake_create_game)
    monkeypatch.setattr(handlers.connection_manager, "subscribe", lambda ws, gid: None)

    response = asyncio.run(
        handlers.handle_start_game(
            object(),
            {"type": "start_game", "timeControlMs": 180_000, "incrementMs": 2_000, "playerColor": "white"},
        )
    )

    timer = timers_module.get_timer(game_id)
    assert response is not None
    assert response["incrementMs"] == 2_000
    assert timer is not None
    assert timer["increment_ms"] == 2_000


def test_player_move_adds_increment_for_both_completed_moves(monkeypatch):
    game_id = uuid.uuid4()
    appended_moves: list[dict] = []

    timers_module.register_game(game_id, 120_000, "white", START_FEN, increment_ms=1_000)

    async def fake_get_game(gid: uuid.UUID):
        assert gid == game_id
        return {"id": gid, "player_color": "white", "ended_at": None}

    async def fake_get_move_count(gid: uuid.UUID):
        assert gid == game_id
        return len(appended_moves)

    async def fake_append_move(
        gid: uuid.UUID,
        ply: int,
        fen: str,
        san: str,
        from_square: str | None = None,
        to_square: str | None = None,
        captured: str | None = None,
    ):
        appended_moves.append(
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

    async def fake_get_moves_by_game(gid: uuid.UUID):
        assert gid == game_id
        return appended_moves

    async def fake_run_ai(fen: str):
        assert fen == AFTER_E4_FEN
        return {
            "updated_fen": AFTER_E4_E5_FEN,
            "result": "*",
            "san": "e5",
            "from_square": "e7",
            "to_square": "e5",
            "captured": None,
        }

    monkeypatch.setattr(handlers.games_db, "get_game", fake_get_game)
    monkeypatch.setattr(handlers.moves_db, "get_move_count", fake_get_move_count)
    monkeypatch.setattr(handlers.moves_db, "append_move", fake_append_move)
    monkeypatch.setattr(handlers.moves_db, "get_moves_by_game", fake_get_moves_by_game)
    monkeypatch.setattr(handlers, "_run_ai", fake_run_ai)
    monkeypatch.setattr(handlers.connection_manager, "subscribe", lambda ws, gid: None)

    response = asyncio.run(
        handlers.handle_player_move(
            object(),
            {
                "type": "player_move",
                "gameId": str(game_id),
                "fen": AFTER_E4_FEN,
                "san": "e4",
                "from": "e2",
                "to": "e4",
            },
        )
    )

    timer = timers_module.get_timer(game_id)
    assert response is not None
    assert response["type"] == "ai_move"
    assert timer is not None
    assert timer["player_time_ms"] == 121_000
    assert timer["ai_time_ms"] == 121_000
