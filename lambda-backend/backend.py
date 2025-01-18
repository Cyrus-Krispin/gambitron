import chess
import chess.engine
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

material_values = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100
}

pawn_table = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5,  5,  5,  5,  5,  5,  5,  5,
     1,  1,  2,  3,  3,  2,  1,  1,
     0,  0,  0,  2,  2,  0,  0,  0,
     0,  0,  0, -2, -2,  0,  0,  0,
     1, -1, -2,  0,  0, -2, -1,  1,
     1,  2,  2, -2, -2,  2,  2,  1,
     0,  0,  0,  0,  0,  0,  0,  0
]

knight_table = [
    -5, -4, -3, -3, -3, -3, -4, -5,
    -4, -2,  0,  0,  0,  0, -2, -4,
    -3,  0,  1,  1,  1,  1,  0, -3,
    -3,  0,  1,  2,  2,  1,  0, -3,
    -3,  0,  1,  2,  2,  1,  0, -3,
    -3,  0,  1,  1,  1,  1,  0, -3,
    -4, -2,  0,  0,  0,  0, -2, -4,
    -5, -4, -3, -3, -3, -3, -4, -5
]

bishop_table = [
    -2, -1, -1, -1, -1, -1, -1, -2,
    -1,  0,  0,  0,  0,  0,  0, -1,
    -1,  0,  1,  1,  1,  1,  0, -1,
    -1,  0,  1,  2,  2,  1,  0, -1,
    -1,  0,  1,  2,  2,  1,  0, -1,
    -1,  0,  1,  1,  1,  1,  0, -1,
    -1,  0,  0,  0,  0,  0,  0, -1,
    -2, -1, -1, -1, -1, -1, -1, -2
]

rook_table = [
     0,  0,  0,  0,  0,  0,  0,  0,
     1,  1,  1,  1,  1,  1,  1,  1,
     0,  0,  0,  0,  0,  0,  0,  0,
     0,  0,  0,  0,  0,  0,  0,  0,
     0,  0,  0,  0,  0,  0,  0,  0,
     0,  0,  0,  0,  0,  0,  0,  0,
     1,  1,  1,  1,  1,  1,  1,  1,
     0,  0,  0,  1,  1,  0,  0,  0
]

queen_table = [
    -2, -1, -1, -1, -1, -1, -1, -2,
    -1,  0,  0,  0,  0,  0,  0, -1,
    -1,  0,  1,  1,  1,  1,  0, -1,
    -1,  0,  1,  2,  2,  1,  0, -1,
    -1,  0,  1,  2,  2,  1,  0, -1,
    -1,  0,  1,  1,  1,  1,  0, -1,
    -1,  0,  0,  0,  0,  0,  0, -1,
    -2, -1, -1, -1, -1, -1, -1, -2
]

king_table = [
    -3, -4, -4, -5, -5, -4, -4, -3,
    -3, -4, -4, -5, -5, -4, -4, -3,
    -3, -4, -4, -5, -5, -4, -4, -3,
    -3, -4, -4, -5, -5, -4, -4, -3,
    -2, -3, -3, -4, -4, -3, -3, -2,
    -1, -2, -2, -2, -2, -2, -2, -1,
     2,  2,  0,  0,  0,  0,  2,  2,
     2,  3,  1,  0,  0,  1,  3,  2
]

piece_square_tables = {
    chess.PAWN: pawn_table,
    chess.KNIGHT: knight_table,
    chess.BISHOP: bishop_table,
    chess.ROOK: rook_table,
    chess.QUEEN: queen_table,
    chess.KING: king_table
}

def evaluate_board(board: chess.Board):
    if board.is_checkmate():
        return -99999 if board.turn == chess.WHITE else 99999
    if board.is_stalemate() or board.is_insufficient_material():
        return 0
    score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            value = material_values[piece.piece_type]
            position_value = piece_square_tables[piece.piece_type][square]
            if not piece.color:
                position_value = piece_square_tables[piece.piece_type][chess.square_mirror(square)]
            piece_value = value + position_value
            score += piece_value * 4 if piece.color else -piece_value * 4
    mobility_score = 0
    original_turn = board.turn
    for color in [chess.WHITE, chess.BLACK]:
        board.turn = color
        mobility_score += len(list(board.legal_moves)) * (1 if color else -1)
    board.turn = original_turn
    score += mobility_score * 0.1
    pawn_score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece and piece.piece_type == chess.PAWN:
            file = chess.square_file(square)
            pawns_in_file = sum(1 for s in board.pieces(chess.PAWN, piece.color) if chess.square_file(s) == file)
            if pawns_in_file > 1:
                pawn_score -= 20 * (1 if piece.color else -1)
            adjacent_files = []
            if file > 0:
                adjacent_files.append(file - 1)
            if file < 7:
                adjacent_files.append(file + 1)
            has_adjacent_pawn = False
            for adj_file in adjacent_files:
                if any(chess.square_file(s) == adj_file for s in board.pieces(chess.PAWN, piece.color)):
                    has_adjacent_pawn = True
                    break
            if not has_adjacent_pawn:
                pawn_score -= 10 * (1 if piece.color else -1)
    score += pawn_score
    for color in [chess.WHITE, chess.BLACK]:
        king_square = board.king(color)
        if king_square is not None:
            king_file = chess.square_file(king_square)
            king_rank = chess.square_rank(king_square)
            defending_pieces = 0
            for rank_offset in [-1, 0, 1]:
                for file_offset in [-1, 0, 1]:
                    if rank_offset == 0 and file_offset == 0:
                        continue
                    target_rank = king_rank + rank_offset
                    target_file = king_file + file_offset
                    if 0 <= target_rank <= 7 and 0 <= target_file <= 7:
                        target_square = chess.square(target_file, target_rank)
                        piece = board.piece_at(target_square)
                        if piece and piece.color == color:
                            defending_pieces += 1
            king_safety_score = defending_pieces * 10
            score += king_safety_score if color else -king_safety_score
    return score

def minimax(board: chess.Board, depth: int, alpha: float, beta: float, maximizing_player: bool):
    if depth == 0 or board.is_game_over():
        return evaluate_board(board)
    if maximizing_player:
        max_eval = float('-inf')
        for move in board.legal_moves:
            board.push(move)
            eval_score = minimax(board, depth - 1, alpha, beta, False)
            board.pop()
            max_eval = max(max_eval, eval_score)
            alpha = max(alpha, eval_score)
            if beta <= alpha:
                break
        return max_eval
    else:
        min_eval = float('inf')
        for move in board.legal_moves:
            board.push(move)
            eval_score = minimax(board, depth - 1, alpha, beta, True)
            board.pop()
            min_eval = min(min_eval, eval_score)
            beta = min(beta, eval_score)
            if beta <= alpha:
                break
        return min_eval

def best_move(board: chess.Board, depth: int):
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        return None
    def capture_value(m: chess.Move):
        captured_piece = board.piece_at(m.to_square)
        if captured_piece is not None:
            return material_values[captured_piece.piece_type]
        return 0
    legal_moves.sort(key=capture_value, reverse=True)
    worst_eval = float('inf')
    chosen_move = None
    for move in legal_moves:
        board.push(move)
        eval_score = minimax(board, depth - 1, float('-inf'), float('inf'), True)
        board.pop()
        if eval_score < worst_eval:
            worst_eval = eval_score
            chosen_move = move
    return chosen_move  
        

def get_best_move(fen_str: str, depth: int = 3):
    try:
        board = chess.Board(fen_str)
    except ValueError as e:
        raise ValueError("Invalid FEN string.") from e
    if board.is_game_over():
        return {"updated_fen": board.fen(), "result": board.result()}
    move = best_move(board, depth)
    if move is None:
        raise ValueError("No valid moves found.")
    board.push(move)
    return {"updated_fen": board.fen(), "result": board.result()}

@app.post("/")
async def fen_endpoint(value: str):
    try:
        return get_best_move(value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
