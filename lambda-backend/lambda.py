import json
import chess
import chess.engine 


def lambda_handler(event, context):
    fen_str = event['queryStringParameters']['value']
    updated_fen, result = get_best_move(fen_str)
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, POST',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': json.dumps({'updated_fen': updated_fen, 'result': result})
    }

    
PAWN_VALUE = 100
KNIGHT_VALUE = 320
BISHOP_VALUE = 330
ROOK_VALUE = 500
QUEEN_VALUE = 900
KING_VALUE = 20000

material_values = {
    chess.PAWN: PAWN_VALUE,
    chess.KNIGHT: KNIGHT_VALUE,
    chess.BISHOP: BISHOP_VALUE,
    chess.ROOK: ROOK_VALUE,
    chess.QUEEN: QUEEN_VALUE,
    chess.KING: KING_VALUE
}

pawn_table = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0
]

knight_table = [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
]

bishop_table = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
]

rook_table = [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  5,  5,  0,  0,  0
]

queen_table = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
]

king_table = [
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
    chess.KING: king_table
}

CENTER_SQUARES = {chess.D4, chess.E4, chess.D5, chess.E5}
CENTER_PAWN_BONUS = 30
ADVANCED_PAWN_MULTIPLIER = 3

def evaluate_board_state(board_state: chess.Board) -> float:
    if board_state.is_checkmate():
        return -999999 if board_state.turn == chess.WHITE else 999999
    if board_state.is_stalemate() or board_state.is_insufficient_material():
        return 0
    evaluation_score = 0
    white_bishops_count = len(board_state.pieces(chess.BISHOP, chess.WHITE))
    black_bishops_count = len(board_state.pieces(chess.BISHOP, chess.BLACK))
    for square in chess.SQUARES:
        piece = board_state.piece_at(square)
        if piece:
            piece_type = piece.piece_type
            base_value = material_values[piece_type]
            if piece.color == chess.WHITE:
                piece_square_value = piece_square_tables[piece_type][square]
                evaluation_score += base_value + piece_square_value
            else:
                piece_square_value = piece_square_tables[piece_type][63 - square]
                evaluation_score -= base_value + piece_square_value
            if piece_type == chess.PAWN:
                if square in CENTER_SQUARES:
                    if piece.color == chess.WHITE:
                        evaluation_score += CENTER_PAWN_BONUS
                    else:
                        evaluation_score -= CENTER_PAWN_BONUS
                pawn_rank = chess.square_rank(square)
                if piece.color == chess.WHITE:
                    evaluation_score += pawn_rank * ADVANCED_PAWN_MULTIPLIER
                else:
                    evaluation_score -= (7 - pawn_rank) * ADVANCED_PAWN_MULTIPLIER
    if white_bishops_count >= 2:
        evaluation_score += 30
    if black_bishops_count >= 2:
        evaluation_score -= 30
    for color in [chess.WHITE, chess.BLACK]:
        rooks = board_state.pieces(chess.ROOK, color)
        for rook_square in rooks:
            file_index = chess.square_file(rook_square)
            white_pawn_count = 0
            black_pawn_count = 0
            for sq in range(file_index, 64, 8):
                piece_on_sq = board_state.piece_at(sq)
                if piece_on_sq and piece_on_sq.piece_type == chess.PAWN:
                    if piece_on_sq.color == chess.WHITE:
                        white_pawn_count += 1
                    else:
                        black_pawn_count += 1
            if white_pawn_count == 0 and black_pawn_count == 0:
                bonus = 10
            elif (color == chess.WHITE and white_pawn_count == 0) or (color == chess.BLACK and black_pawn_count == 0):
                bonus = 5
            else:
                bonus = 0
            evaluation_score += bonus if color == chess.WHITE else -bonus
    for color in [chess.WHITE, chess.BLACK]:
        pawn_squares = board_state.pieces(chess.PAWN, color)
        file_occurrences = {}
        for square in pawn_squares:
            file_index = chess.square_file(square)
            file_occurrences[file_index] = file_occurrences.get(file_index, 0) + 1
        for file_index, count in file_occurrences.items():
            if count > 1:
                doubled_penalty = 15 * (count - 1)
                evaluation_score += -doubled_penalty if color == chess.WHITE else doubled_penalty
        for file_index in file_occurrences:
            if (file_index - 1) not in file_occurrences and (file_index + 1) not in file_occurrences:
                isolated_penalty = 10
                evaluation_score += -isolated_penalty if color == chess.WHITE else isolated_penalty
    original_turn = board_state.turn
    mobility_score = 0
    for color in [chess.WHITE, chess.BLACK]:
        board_state.turn = color
        legal_moves_count = len(list(board_state.legal_moves))
        mobility_score += legal_moves_count if color == chess.WHITE else -legal_moves_count
    board_state.turn = original_turn
    evaluation_score += 0.1 * mobility_score
    return evaluation_score

def minimax(board_state: chess.Board, depth: int, alpha: float, beta: float, is_maximizing: bool) -> float:
    if depth == 0 or board_state.is_game_over():
        return evaluate_board_state(board_state)
    if is_maximizing:
        max_eval = float('-inf')
        for move in board_state.legal_moves:
            board_state.push(move)
            move_eval = minimax(board_state, depth - 1, alpha, beta, False)
            board_state.pop()
            max_eval = max(max_eval, move_eval)
            alpha = max(alpha, move_eval)
            if beta <= alpha:
                break
        return max_eval
    else:
        min_eval = float('inf')
        for move in board_state.legal_moves:
            board_state.push(move)
            move_eval = minimax(board_state, depth - 1, alpha, beta, True)
            board_state.pop()
            min_eval = min(min_eval, move_eval)
            beta = min(beta, move_eval)
            if beta <= alpha:
                break
        return min_eval

def select_best_move(board_state: chess.Board, depth: int):
    legal_moves_list = list(board_state.legal_moves)
    if not legal_moves_list:
        return None
    def capture_value(move: chess.Move):
        captured_piece = board_state.piece_at(move.to_square)
        return material_values[captured_piece.piece_type] if captured_piece else 0
    legal_moves_list.sort(key=capture_value, reverse=True)
    if board_state.turn == chess.WHITE:
        best_evaluation = float('-inf')
        best_move_found = None
        for move in legal_moves_list:
            board_state.push(move)
            move_evaluation = minimax(board_state, depth - 1, float('-inf'), float('inf'), False)
            board_state.pop()
            if move_evaluation > best_evaluation:
                best_evaluation = move_evaluation
                best_move_found = move
        return best_move_found
    else:
        best_evaluation = float('inf')
        best_move_found = None
        for move in legal_moves_list:
            board_state.push(move)
            move_evaluation = minimax(board_state, depth - 1, float('-inf'), float('inf'), True)
            board_state.pop()
            if move_evaluation < best_evaluation:
                best_evaluation = move_evaluation
                best_move_found = move
        return best_move_found

def get_best_move(fen_str: str, depth: int = 3):
    try:
        board_state = chess.Board(fen_str)
    except ValueError as e:
        raise ValueError("Invalid FEN string.") from e
    if board_state.is_game_over():
        return {"updated_fen": board_state.fen(), "result": board_state.result()}
    chosen_move = select_best_move(board_state, depth)
    if chosen_move is None:
        raise ValueError("No valid moves found.")
    board_state.push(chosen_move)
    return board_state.fen(), board_state.result()