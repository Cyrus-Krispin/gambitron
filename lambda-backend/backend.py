import chess
import chess.engine

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow requests from your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


@app.post("/")
async def root(value: str):
    return get_best_move(value)

import chess

def evaluate_board(board):
    if board.is_checkmate():
        return -10000 if board.turn else 10000
    if board.is_stalemate() or board.is_insufficient_material():
        return 0
        
    score = 0
    
    # Material values with slight adjustments from traditional values
    material_values = {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 20000
    }
    
    # Piece-square tables for positional bonuses
    pawn_table = [
        0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    ]
    
    knight_table = [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ]
    
    bishop_table = [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20
    ]
    
    rook_table = [
        0,  0,  0,  0,  0,  0,  0,  0,
        5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        0,  0,  0,  5,  5,  0,  0,  0
    ]
    
    queen_table = [
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
        -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20
    ]
    
    king_table_middlegame = [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
        20, 20,  0,  0,  0,  0, 20, 20,
        20, 30, 10,  0,  0, 10, 30, 20
    ]
    
    piece_square_tables = {
        chess.PAWN: pawn_table,
        chess.KNIGHT: knight_table,
        chess.BISHOP: bishop_table,
        chess.ROOK: rook_table,
        chess.QUEEN: queen_table,
        chess.KING: king_table_middlegame
    }
    
    # Evaluate each piece
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            # Material value
            value = material_values[piece.piece_type]
            
            # Position value from piece-square tables
            position_value = piece_square_tables[piece.piece_type][square]
            if not piece.color:  # If black, flip the square index
                position_value = piece_square_tables[piece.piece_type][chess.square_mirror(square)]
            
            # Combine material and position value
            piece_value = value + position_value
            
            # Add to score (positive for white, negative for black)
            score += piece_value if piece.color else -piece_value
    
    # Mobility evaluation
    mobility_score = 0
    
    # Save the current turn
    original_turn = board.turn
    
    # Count legal moves for both sides
    for color in [chess.WHITE, chess.BLACK]:
        board.turn = color
        mobility_score += len(list(board.legal_moves)) * (1 if color else -1)
    
    # Restore the original turn
    board.turn = original_turn
    
    # Add mobility score with a weight
    score += mobility_score * 0.1
    
    # Pawn structure evaluation
    pawn_score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece and piece.piece_type == chess.PAWN:
            # Doubled pawns penalty
            file = chess.square_file(square)
            pawns_in_file = sum(1 for s in board.pieces(chess.PAWN, piece.color) 
                              if chess.square_file(s) == file)
            if pawns_in_file > 1:
                pawn_score -= 20 * (1 if piece.color else -1)
            
            # Isolated pawns penalty
            adjacent_files = []
            if file > 0:
                adjacent_files.append(file - 1)
            if file < 7:
                adjacent_files.append(file + 1)
            
            has_adjacent_pawn = False
            for adj_file in adjacent_files:
                if any(chess.square_file(s) == adj_file 
                      for s in board.pieces(chess.PAWN, piece.color)):
                    has_adjacent_pawn = True
                    break
            
            if not has_adjacent_pawn:
                pawn_score -= 10 * (1 if piece.color else -1)
    
    score += pawn_score
    
    # King safety evaluation (simplified)
    for color in [chess.WHITE, chess.BLACK]:
        king_square = board.king(color)
        if king_square is not None:
            # Count pieces near the king
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

def minimax(board, depth, alpha, beta, maximizing_player):
    if depth == 0 or board.is_game_over():
        return evaluate_board(board)

    legal_moves = list(board.legal_moves)
    if maximizing_player:
        max_eval = float('-inf')
        for move in legal_moves:
            board.push(move)
            eval = minimax(board, depth - 1, alpha, beta, False)
            board.pop()
            max_eval = max(max_eval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        return max_eval
    else:
        min_eval = float('inf')
        for move in legal_moves:
            board.push(move)
            eval = minimax(board, depth - 1, alpha, beta, True)
            board.pop()
            min_eval = min(min_eval, eval)
            beta = min(beta, eval)
            if beta <= alpha:
                break
        return min_eval

def best_move(board, depth):
    best_move = None
    max_eval = float('-inf')

    legal_moves = list(board.legal_moves)
    for move in legal_moves:
        board.push(move)
        eval = minimax(board, depth - 1, float('-inf'), float('inf'), False)
        board.pop()
        if eval > max_eval:
            max_eval = eval
            best_move = move

    return best_move

def get_best_move(fen_str, depth=3):
    board = chess.Board(fen_str)

    move = best_move(board, depth)
    
    board.push(move)

    result = board.result()
    updated_fen = board.fen()

    response = {
        "updated_fen": updated_fen,
        "result": result
    }

    return response


