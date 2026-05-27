"""WebSocket message handlers."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
import json
import uuid

import chess
from fastapi import WebSocket

from chess_engine import get_best_move
from opening_book import reset_book
from db import games as games_db
from db import moves as moves_db
from game_rules import check_3_move_repetition
from websocket import connection_manager
from websocket import timers as timers_module

PIECE_TO_SYMBOL = {
    chess.PAWN: "p",
    chess.KNIGHT: "n",
    chess.BISHOP: "b",
    chess.ROOK: "r",
    chess.QUEEN: "q",
}

PROMOTION_PIECES = {"q", "r", "b", "n"}


@dataclass
class ValidatedPlayerMove:
    board: chess.Board
    san: str
    from_square: str
    to_square: str
    captured: str | None


async def _run_ai(fen: str):
    """Run AI in thread pool (CPU-bound)."""
    return await asyncio.to_thread(get_best_move, fen)


def _termination_from_result(result: str) -> str:
    """Map chess result to termination reason."""
    if result == "1-0" or result == "0-1":
        return "checkmate"
    if result == "1/2-1/2":
        return "draw"
    return "unknown"


def _captured_piece_symbol(board: chess.Board, move: chess.Move) -> str | None:
    """Return captured piece metadata before pushing a legal move."""
    if board.is_en_passant(move):
        captured_square = chess.square(chess.square_file(move.to_square), chess.square_rank(move.from_square))
        captured_piece = board.piece_at(captured_square)
    else:
        captured_piece = board.piece_at(move.to_square)
    if not captured_piece:
        return None
    return PIECE_TO_SYMBOL.get(captured_piece.piece_type)


def _promotion_from_payload(data: dict, san: str | None) -> str:
    promotion = data.get("promotion")
    if isinstance(promotion, str) and promotion.lower() in PROMOTION_PIECES:
        return promotion.lower()
    if san and "=" in san:
        candidate = san.split("=")[-1].strip().lower()[:1]
        if candidate in PROMOTION_PIECES:
            return candidate
    return ""


def _move_from_payload(
    board: chess.Board,
    data: dict,
    san: str | None,
    from_sq: str | None,
    to_sq: str | None,
) -> chess.Move | None:
    """Build a move from client payload fields against the server board."""
    if from_sq and to_sq:
        try:
            return chess.Move.from_uci(f"{from_sq}{to_sq}{_promotion_from_payload(data, san)}")
        except ValueError:
            return None
    if san:
        try:
            return board.parse_san(san)
        except ValueError:
            return None
    return None


def _validate_player_move(
    previous_fen: str,
    submitted_fen: str,
    data: dict,
    san: str | None,
    from_sq: str | None,
    to_sq: str | None,
) -> ValidatedPlayerMove | None:
    """Validate a client move from the server's previous FEN to the submitted FEN."""
    try:
        previous_board = chess.Board(previous_fen)
    except ValueError:
        return None

    move = _move_from_payload(previous_board, data, san, from_sq, to_sq)
    if move is None or move not in previous_board.legal_moves:
        return None

    canonical_san = previous_board.san(move)
    canonical_from = chess.square_name(move.from_square)
    canonical_to = chess.square_name(move.to_square)
    captured = _captured_piece_symbol(previous_board, move)

    previous_board.push(move)
    try:
        submitted_board = chess.Board(submitted_fen)
    except ValueError:
        return None
    if submitted_board.fen() != previous_board.fen():
        return None

    return ValidatedPlayerMove(
        board=previous_board,
        san=canonical_san,
        from_square=canonical_from,
        to_square=canonical_to,
        captured=captured,
    )


def _coerce_increment_ms(value) -> int | None:
    """Return a sanitized non-negative increment, or None for invalid input."""
    if value is None:
        return 0
    if not isinstance(value, (int, float)):
        return None
    value = int(value)
    if value < 0:
        return None
    return value


async def handle_start_game(ws: WebSocket, data: dict) -> dict | None:
    """Handle start_game. Returns response to send."""
    time_control_ms = data.get("timeControlMs")
    increment_ms = _coerce_increment_ms(data.get("incrementMs"))
    player_color = data.get("playerColor", "white")
    if time_control_ms is None or not isinstance(time_control_ms, (int, float)):
        return {"type": "error", "message": "timeControlMs required"}
    if increment_ms is None:
        return {"type": "error", "message": "incrementMs must be a non-negative number"}
    time_control_ms = int(time_control_ms)
    if player_color not in ("white", "black"):
        player_color = "white"

    game_id = await games_db.create_game(time_control_ms, player_color, increment_ms)
    reset_book()
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    timers_module.register_game(game_id, time_control_ms, player_color, fen, increment_ms)
    connection_manager.subscribe(ws, game_id)
    return {
        "type": "game_started",
        "gameId": str(game_id),
        "fen": fen,
        "timeControlMs": time_control_ms,
        "incrementMs": increment_ms,
        "playerTimeMs": time_control_ms,
        "aiTimeMs": time_control_ms,
    }


async def handle_player_move(ws: WebSocket, data: dict) -> dict | None:
    """Handle player_move. Returns response to send (ai_move or game_ended)."""
    game_id_str = data.get("gameId")
    fen = data.get("fen")
    san = data.get("san")
    from_sq = data.get("from")
    to_sq = data.get("to")

    if not game_id_str or not fen:
        return {"type": "error", "message": "gameId and fen required"}

    try:
        game_id = uuid.UUID(game_id_str)
    except ValueError:
        return {"type": "error", "message": "Invalid gameId"}

    connection_manager.subscribe(ws, game_id)

    game = await games_db.get_game(game_id)
    if not game or game.get("ended_at"):
        return {"type": "error", "message": "Game not found or already ended"}

    player_color = game.get("player_color", "white")
    timer = timers_module.get_timer(game_id)
    if not timer:
        return {"type": "error", "message": "Game state unavailable"}
    previous_fen = timer["fen"]

    times = timers_module.apply_elapsed(game_id)
    if times:
        pt, at = times
        if timers_module.is_player_turn(previous_fen, player_color) and pt <= 0:
            timers_module.mark_ended(game_id)
            timers_module.remove_game(game_id)
            timeout_result = "0-1" if player_color == "white" else "1-0"
            await moves_db.finalize_game_to_pgn(game_id, timeout_result, "timeout", player_color)
            return {
                "type": "game_ended",
                "gameId": str(game_id),
                "result": timeout_result,
                "termination": "timeout",
            }

    if not timers_module.is_player_turn(previous_fen, player_color):
        return {"type": "error", "message": "Not player's turn"}

    validated_move = _validate_player_move(
        previous_fen,
        fen,
        data,
        san,
        from_sq,
        to_sq,
    )
    if validated_move is None:
        return {"type": "error", "message": "Illegal move"}
    board = validated_move.board
    fen = board.fen()
    san = validated_move.san
    from_sq = validated_move.from_square
    to_sq = validated_move.to_square
    player_captured = validated_move.captured

    move_count = await moves_db.get_move_count(game_id)
    player_ply = move_count + 1

    if player_color == "white" and move_count == 0:
        timers_module.clear_player_first_move_pending(game_id)

    await moves_db.append_move(game_id, player_ply, fen, san, from_sq, to_sq, player_captured)
    timers_module.add_player_increment(game_id)

    # Check for draw by 3-move repetition after player move
    all_moves = await moves_db.get_moves_by_game(game_id)
    if check_3_move_repetition(all_moves):
        timers_module.remove_game(game_id)
        await moves_db.finalize_game_to_pgn(game_id, "1/2-1/2", "threefold repetition", player_color)
        return {
            "type": "game_ended",
            "gameId": str(game_id),
            "result": "1/2-1/2",
            "termination": "threefold repetition",
        }

    if board.is_game_over():
        result = board.result()
        termination = _termination_from_result(result)
        timers_module.remove_game(game_id)
        await moves_db.finalize_game_to_pgn(game_id, result, termination, player_color)
        return {
            "type": "game_ended",
            "gameId": str(game_id),
            "result": result,
            "termination": termination,
        }

    timers_module.update_fen(game_id, fen)

    ai_result = await _run_ai(fen)
    times = timers_module.apply_elapsed(game_id)
    if times:
        pt, at = times
        t = timers_module.get_timer(game_id)
        if t and not timers_module.is_player_turn(t["fen"], player_color) and at <= 0:
            timers_module.mark_ended(game_id)
            timers_module.remove_game(game_id)
            timeout_result = "1-0" if player_color == "white" else "0-1"
            await moves_db.finalize_game_to_pgn(game_id, timeout_result, "timeout", player_color)
            return {
                "type": "game_ended",
                "gameId": str(game_id),
                "result": timeout_result,
                "termination": "timeout",
            }
    updated_fen = ai_result["updated_fen"]
    result = ai_result["result"]

    ai_ply = player_ply + 1
    ai_san = ai_result.get("san") or ""
    ai_from = ai_result.get("from_square")
    ai_to = ai_result.get("to_square")
    ai_captured = ai_result.get("captured")
    await moves_db.append_move(game_id, ai_ply, updated_fen, ai_san, ai_from, ai_to, ai_captured)

    timers_module.update_fen(game_id, updated_fen)
    timers_module.add_ai_increment(game_id)

    # Check for draw by 3-move repetition after AI move
    all_moves = await moves_db.get_moves_by_game(game_id)
    if check_3_move_repetition(all_moves):
        timers_module.remove_game(game_id)
        await moves_db.finalize_game_to_pgn(game_id, "1/2-1/2", "threefold repetition", player_color)
        return {
            "type": "game_ended",
            "gameId": str(game_id),
            "result": "1/2-1/2",
            "termination": "threefold repetition",
            "updatedFen": updated_fen,
            "aiSan": ai_san,
            "aiFromSquare": ai_from,
            "aiToSquare": ai_to,
            "captured": ai_captured,
        }

    if result and result != "*":
        termination = _termination_from_result(result)
        timers_module.remove_game(game_id)
        await moves_db.finalize_game_to_pgn(game_id, result, termination, player_color)
        return {
            "type": "game_ended",
            "gameId": str(game_id),
            "result": result,
            "termination": termination,
            "updatedFen": updated_fen,
            "aiSan": ai_san,
            "aiFromSquare": ai_from,
            "aiToSquare": ai_to,
            "captured": ai_captured,
        }

    return {
        "type": "ai_move",
        "updatedFen": updated_fen,
        "result": result,
        "san": ai_san,
        "fromSquare": ai_from,
        "toSquare": ai_to,
        "captured": ai_captured,
    }


async def handle_request_ai_move(ws: WebSocket, data: dict) -> dict | None:
    """Handle request_ai_move - when player is black, AI moves first. No player move inserted."""
    game_id_str = data.get("gameId")
    fen = data.get("fen")

    if not game_id_str or not fen:
        return {"type": "error", "message": "gameId and fen required"}

    try:
        game_id = uuid.UUID(game_id_str)
    except ValueError:
        return {"type": "error", "message": "Invalid gameId"}

    connection_manager.subscribe(ws, game_id)

    game = await games_db.get_game(game_id)
    if not game or game.get("ended_at"):
        return {"type": "error", "message": "Game not found or already ended"}

    move_count = await moves_db.get_move_count(game_id)
    if move_count > 0:
        return {"type": "error", "message": "request_ai_move only valid at game start"}

    player_color = game.get("player_color", "white")
    times = timers_module.apply_elapsed(game_id)
    if times:
        pt, at = times
        t = timers_module.get_timer(game_id)
        if t and not timers_module.is_player_turn(fen, player_color) and at <= 0:
            timers_module.mark_ended(game_id)
            timers_module.remove_game(game_id)
            timeout_result = "1-0" if player_color == "white" else "0-1"
            await moves_db.finalize_game_to_pgn(game_id, timeout_result, "timeout", player_color)
            return {
                "type": "game_ended",
                "gameId": str(game_id),
                "result": timeout_result,
                "termination": "timeout",
            }

    ai_result = await _run_ai(fen)
    timers_module.apply_elapsed(game_id)
    updated_fen = ai_result["updated_fen"]
    result = ai_result["result"]

    ai_ply = 1
    ai_san = ai_result.get("san") or ""
    ai_from = ai_result.get("from_square")
    ai_to = ai_result.get("to_square")
    ai_captured = ai_result.get("captured")
    await moves_db.append_move(game_id, ai_ply, updated_fen, ai_san, ai_from, ai_to, ai_captured)

    timers_module.update_fen(game_id, updated_fen)
    timers_module.clear_ai_first_move_pending(game_id)
    timers_module.add_ai_increment(game_id)

    # Check for draw by 3-move repetition after AI move
    all_moves = await moves_db.get_moves_by_game(game_id)
    if check_3_move_repetition(all_moves):
        timers_module.remove_game(game_id)
        await moves_db.finalize_game_to_pgn(game_id, "1/2-1/2", "threefold repetition", player_color)
        return {
            "type": "game_ended",
            "gameId": str(game_id),
            "result": "1/2-1/2",
            "termination": "threefold repetition",
            "updatedFen": updated_fen,
            "aiSan": ai_san,
            "aiFromSquare": ai_from,
            "aiToSquare": ai_to,
            "captured": ai_captured,
        }

    if result and result != "*":
        termination = _termination_from_result(result)
        timers_module.remove_game(game_id)
        await moves_db.finalize_game_to_pgn(game_id, result, termination, player_color)
        return {
            "type": "game_ended",
            "gameId": str(game_id),
            "result": result,
            "termination": termination,
            "updatedFen": updated_fen,
            "aiSan": ai_san,
            "aiFromSquare": ai_from,
            "aiToSquare": ai_to,
            "captured": ai_captured,
        }

    return {
        "type": "ai_move",
        "updatedFen": updated_fen,
        "result": result,
        "san": ai_san,
        "fromSquare": ai_from,
        "toSquare": ai_to,
        "captured": ai_captured,
    }


async def handle_promotion_move(ws: WebSocket, data: dict) -> dict | None:
    """Handle promotion_move. Same flow as player_move."""
    game_id_str = data.get("gameId")
    fen = data.get("fen")
    from_sq = data.get("from")
    to_sq = data.get("to")
    promotion = data.get("promotion", "q")

    if not game_id_str or not fen or not from_sq or not to_sq:
        return {"type": "error", "message": "gameId, fen, from, to required"}

    piece = promotion.upper() if promotion else "Q"
    san = f"{from_sq}{to_sq}={piece}"

    data["san"] = san
    data["from"] = from_sq
    data["to"] = to_sq
    return await handle_player_move(ws, data)


async def handle_subscribe(ws: WebSocket, data: dict) -> dict | None:
    """Handle subscribe - reconnect to a game. Returns full game_state."""
    game_id_str = data.get("gameId")
    if not game_id_str:
        return {"type": "error", "message": "gameId required"}

    try:
        game_id = uuid.UUID(game_id_str)
    except ValueError:
        return {"type": "error", "message": "Invalid gameId"}

    game = await games_db.get_game(game_id)
    if not game:
        return {"type": "error", "message": "Game not found"}

    connection_manager.subscribe(ws, game_id)

    player_color = game.get("player_color", "white")
    time_control_ms = game.get("time_control_ms", 60000)

    t = timers_module.get_timer(game_id)
    if t:
        return {
            "type": "game_state",
            "gameId": str(game_id),
            "fen": t["fen"],
            "playerTimeMs": t["player_time_ms"],
            "aiTimeMs": t["ai_time_ms"],
            "timeControlMs": time_control_ms,
            "incrementMs": t.get("increment_ms", 0),
            "playerColor": player_color,
        }

    if game.get("ended_at"):
        moves = await moves_db.get_moves_by_game(game_id)
        fen = moves[-1]["fen"] if moves else "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        return {
            "type": "game_state",
            "gameId": str(game_id),
            "fen": fen,
            "playerTimeMs": 0,
            "aiTimeMs": 0,
            "timeControlMs": time_control_ms,
            "playerColor": player_color,
            "result": game.get("result"),
            "termination": game.get("termination"),
        }

    return {"type": "error", "message": "Game state unavailable"}


async def handle_message(ws: WebSocket, raw: str) -> dict | None:
    """Dispatch message by type. Returns response to send or None."""
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return {"type": "error", "message": "Invalid JSON"}

    msg_type = msg.get("type")
    if not msg_type:
        return {"type": "error", "message": "type required"}

    if msg_type == "start_game":
        return await handle_start_game(ws, msg)
    if msg_type == "subscribe":
        return await handle_subscribe(ws, msg)
    if msg_type == "player_move":
        return await handle_player_move(ws, msg)
    if msg_type == "promotion_move":
        return await handle_promotion_move(ws, msg)
    if msg_type == "request_ai_move":
        return await handle_request_ai_move(ws, msg)
    if msg_type == "ping":
        return {"type": "pong"}

    return {"type": "error", "message": f"Unknown type: {msg_type}"}
