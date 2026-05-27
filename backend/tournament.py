import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import chess

GAMES = 12
DEPTH = 4
TIME_LIMIT = 1.0
STATE_FILE = Path("/tmp/tournament_state.json")

TERMINATION_LABELS = {
    chess.Termination.CHECKMATE: "checkmate",
    chess.Termination.STALEMATE: "stalemate",
    chess.Termination.INSUFFICIENT_MATERIAL: "insufficient material",
    chess.Termination.SEVENTYFIVE_MOVES: "75-move rule",
    chess.Termination.FIVEFOLD_REPETITION: "fivefold repetition",
    chess.Termination.FIFTY_MOVES: "50-move rule",
    chess.Termination.THREEFOLD_REPETITION: "threefold repetition",
}


def _print(*args, **kwargs):
    kwargs.setdefault("flush", True)
    print(*args, **kwargs)


def _write_state(fen, game_label, move_list, results):
    STATE_FILE.write_text(json.dumps({
        "fen": fen,
        "game": game_label,
        "move_list": move_list,
        "results": results,
    }))


def run_game(white_engine, black_engine, white_label, black_label, game_label, results):
    board = chess.Board()
    move_list = []
    while not board.is_game_over() and len(move_list) < 200:
        engine = white_engine if board.turn == chess.WHITE else black_engine
        label = white_label if board.turn == chess.WHITE else black_label
        try:
            result = engine.get_best_move(
                board.fen(), depth=DEPTH, time_limit=TIME_LIMIT
            )
        except Exception:
            return (f"error:{label}", move_list, None)
        if result.get("error") or result.get("san") is None:
            return ("draw:stalemate_or_error", move_list, None)
        chosen = chess.Move.from_uci(
            result["from_square"] + result["to_square"]
        )
        move_list.append(result["san"])
        board.push(chosen)
        _write_state(board.fen(), game_label, move_list, results)

    outcome = board.outcome()
    if outcome is None:
        return ("draw", move_list, None)
    if outcome.winner == chess.WHITE:
        return ("white", move_list, outcome.termination)
    elif outcome.winner == chess.BLACK:
        return ("black", move_list, outcome.termination)
    return ("draw", move_list, outcome.termination)


def load_engine(name, source):
    spec = importlib.util.spec_from_file_location(name, source)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def main():
    old_source = subprocess.check_output(
        ["git", "show", "HEAD:backend/chess_engine.py"], cwd=".."
    )

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", prefix="old_engine_", delete=False
    ) as f:
        f.write(old_source.decode())
        old_path = f.name

    _print(f"Loading engines...")
    new_engine = load_engine("chess_engine_new", "chess_engine.py")
    old_engine = load_engine("chess_engine_old", old_path)
    _print("Done.\n")

    results = {"NEW wins": 0, "OLD wins": 0, "Draws": 0}
    _print(f"Playing {GAMES} games — new (improved center control) vs old (baseline)")
    _print(f"Depth={DEPTH}, Time limit={TIME_LIMIT}s per move")
    _print(f"Spectator: http://localhost:8080")
    _print()

    for game_i in range(1, GAMES + 1):
        start = time.perf_counter()

        if game_i % 2 == 1:
            game_label = f"Game {game_i}/{GAMES}  NEW (White) vs OLD (Black)"
            outcome = run_game(
                new_engine, old_engine, "new (White)", "old (Black)",
                game_label, results,
            )
        else:
            game_label = f"Game {game_i}/{GAMES}  OLD (White) vs NEW (Black)"
            outcome = run_game(
                old_engine, new_engine, "old (White)", "new (Black)",
                game_label, results,
            )

        elapsed = time.perf_counter() - start
        result_code, move_list, termination = outcome
        num_moves = len(move_list)
        term_label = TERMINATION_LABELS.get(termination, str(termination)) if termination else "?"

        if result_code == "white" and game_i % 2 == 1:
            results["NEW wins"] += 1
            _print(f"Game {game_i}: NEW wins by {term_label} (White)  {num_moves // 2}P [{elapsed:.0f}s]")
        elif result_code == "white" and game_i % 2 == 0:
            results["OLD wins"] += 1
            _print(f"Game {game_i}: OLD wins by {term_label} (White)  {num_moves // 2}P [{elapsed:.0f}s]")
        elif result_code == "black" and game_i % 2 == 1:
            results["OLD wins"] += 1
            _print(f"Game {game_i}: OLD wins by {term_label} (Black)  {num_moves // 2}P [{elapsed:.0f}s]")
        elif result_code == "black" and game_i % 2 == 0:
            results["NEW wins"] += 1
            _print(f"Game {game_i}: NEW wins by {term_label} (Black)  {num_moves // 2}P [{elapsed:.0f}s]")
        elif result_code == "draw":
            results["Draws"] += 1
            _print(f"Game {game_i}: draw by {term_label}  {num_moves // 2}P [{elapsed:.0f}s]")
        else:
            _print(f"Game {game_i}: {outcome}  [{elapsed:.0f}s]")

        _write_state("", f"Game {game_i}/{GAMES} — finished ({term_label})", move_list, results)

    _print()
    _print("=" * 50)
    _print("RESULTS")
    for k, v in results.items():
        _print(f"  {k}: {v}")
    _print("=" * 50)

    os.unlink(old_path)
    STATE_FILE.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
