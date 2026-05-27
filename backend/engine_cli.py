import sys
import json

from chess_engine import get_best_move

DEPTH = 5
TIME_LIMIT = 1.0


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            fen = line
            result = get_best_move(fen, depth=DEPTH, time_limit=TIME_LIMIT)
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
