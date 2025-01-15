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

    
def evaluate_board(board: chess.Board) -> float:
    """
    Returns an evaluation of the current board position from White's perspective.
    Positive score favors White, negative favors Black.
    """
    if board.is_checkmate():
        return -99999 if board.turn == chess.WHITE else 99999

    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    # Material values
    piece_values = {
        chess.PAWN: 1,
        chess.KNIGHT: 3,
        chess.BISHOP: 3,
        chess.ROOK: 5,
        chess.QUEEN: 9,
        chess.KING: 100
    }

    material_score = 0

    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            value = piece_values[piece.piece_type]

            if piece.color == chess.WHITE:
                material_score += value
            else:
                material_score -= value

    return material_score

def minimax(board: chess.Board, depth: int, alpha: float, beta: float, maximizing_player: bool) -> float:
    """
    Alpha-beta pruning implementation of minimax to find the best move.
    """
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

def best_move(board: chess.Board, depth: int) -> chess.Move:
    """
    Iterates over all legal moves for the current board,
    uses minimax to select the move with the highest evaluation (for the side to move).
    """
    legal_moves = list(board.legal_moves)
    legal_moves.sort(key=lambda move: board.piece_at(move.to_square).piece_type if board.piece_at(move.to_square) else 0, reverse=True)

    chosen_move = None
    min_eval = float('inf')
    
    for move in legal_moves:
        board.push(move)
        eval_score = minimax(board, depth - 1, float('-inf'), float('inf'), False)
        board.pop()

        if eval_score < min_eval:
            min_eval = eval_score
            chosen_move = move

    return chosen_move

def get_best_move(fen_str: str, depth: int = 3):
    """
    Given a FEN string, returns a JSON-like dict containing:
    - updated_fen: the board FEN after the chosen move is played
    - result: the current game result (if the game ended or not)
    """
    try:
        board = chess.Board(fen_str)
        print(print("Board turn:", board.turn))
    except ValueError as e:
        raise ValueError("Invalid FEN string.") from e

    if board.is_game_over():
        return {
            "updated_fen": board.fen(),
            "result": board.result()
        }

    move = best_move(board, depth)
    if move is None:
        raise ValueError("No valid moves found.")

    board.push(move)
    return board.fen(), board.result()