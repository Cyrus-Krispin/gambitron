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

def evaluate_board(board):
    material_values = {
        chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 1000
    }
    
    score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            score += material_values.get(piece.piece_type, 0) * (1 if piece.color == chess.WHITE else -1)
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

    return updated_fen, result
