import chess
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

PAWN_VALUE=100
KNIGHT_VALUE=320
BISHOP_VALUE=330
ROOK_VALUE=500
QUEEN_VALUE=900
KING_VALUE=20000

material_values={
    chess.PAWN:PAWN_VALUE,
    chess.KNIGHT:KNIGHT_VALUE,
    chess.BISHOP:BISHOP_VALUE,
    chess.ROOK:ROOK_VALUE,
    chess.QUEEN:QUEEN_VALUE,
    chess.KING:KING_VALUE
}

pawn_table=[
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0
]

knight_table=[
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
]

bishop_table=[
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
]

rook_table=[
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  5,  5,  0,  0,  0
]

queen_table=[
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
]

king_table=[
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
]

piece_square_tables={
    chess.PAWN:pawn_table,
    chess.KNIGHT:knight_table,
    chess.BISHOP:bishop_table,
    chess.ROOK:rook_table,
    chess.QUEEN:queen_table,
    chess.KING:king_table
}

def evaluate_board(board:chess.Board)->float:
    if board.is_checkmate():
        return -999999 if board.turn==chess.WHITE else 999999
    if board.is_stalemate() or board.is_insufficient_material():
        return 0
    score=0
    white_bishop_count=len(board.pieces(chess.BISHOP,chess.WHITE))
    black_bishop_count=len(board.pieces(chess.BISHOP,chess.BLACK))
    for square in chess.SQUARES:
        piece=board.piece_at(square)
        if piece:
            piece_type=piece.piece_type
            value=material_values[piece_type]
            if piece.color==chess.WHITE:
                ps=piece_square_tables[piece_type][63-square]
                score+=value
                score+=ps
            else:
                ps=piece_square_tables[piece_type][square]
                score-=value
                score-=ps
    if white_bishop_count>=2:
        score+=30
    if black_bishop_count>=2:
        score-=30
    for color in[chess.WHITE,chess.BLACK]:
        rooks=board.pieces(chess.ROOK,color)
        for r_square in rooks:
            f=chess.square_file(r_square)
            pw=0
            pb=0
            for sq in range(f,64,8):
                p=board.piece_at(sq)
                if p and p.piece_type==chess.PAWN:
                    if p.color==chess.WHITE:
                        pw+=1
                    else:
                        pb+=1
            if pw==0 and pb==0:
                b=10
            elif (color==chess.WHITE and pw==0) or (color==chess.BLACK and pb==0):
                b=5
            else:
                b=0
            score+=b if color==chess.WHITE else -b
    for color in[chess.WHITE,chess.BLACK]:
        psq=board.pieces(chess.PAWN,color)
        fo={}
        for s in psq:
            f=chess.square_file(s)
            if f not in fo:
                fo[f]=0
            fo[f]+=1
        for f,cnt in fo.items():
            if cnt>1:
                pn=15*(cnt-1)
                score+=(-pn if color==chess.WHITE else pn)
        for f in fo:
            if (f-1)not in fo and (f+1)not in fo:
                pn=10
                score+=(-pn if color==chess.WHITE else pn)
    ot=board.turn
    ms=0
    for color in[chess.WHITE,chess.BLACK]:
        board.turn=color
        m=len(list(board.legal_moves))
        ms+=(m if color==chess.WHITE else -m)
    board.turn=ot
    score+=0.1*ms
    return score

def minimax(board:chess.Board,depth:int,alpha:float,beta:float,maximizing_player:bool)->float:
    if depth==0 or board.is_game_over():
        return evaluate_board(board)
    if maximizing_player:
        mx=float('-inf')
        for move in board.legal_moves:
            board.push(move)
            ev=minimax(board,depth-1,alpha,beta,False)
            board.pop()
            mx=max(mx,ev)
            alpha=max(alpha,ev)
            if beta<=alpha:
                break
        return mx
    else:
        mn=float('inf')
        for move in board.legal_moves:
            board.push(move)
            ev=minimax(board,depth-1,alpha,beta,True)
            board.pop()
            mn=min(mn,ev)
            beta=min(beta,ev)
            if beta<=alpha:
                break
        return mn

def best_move(board:chess.Board,depth:int):
    lm=list(board.legal_moves)
    if not lm:
        return None
    def capture_value(m:chess.Move):
        cp=board.piece_at(m.to_square)
        if cp:
            return material_values[cp.piece_type]
        return 0
    lm.sort(key=capture_value,reverse=True)
    if board.turn==chess.WHITE:
        be=float('-inf')
        cm=None
        for move in lm:
            board.push(move)
            ev=minimax(board,depth-1,float('-inf'),float('inf'),False)
            board.pop()
            if ev>be:
                be=ev
                cm=move
        return cm
    else:
        be=float('inf')
        cm=None
        for move in lm:
            board.push(move)
            ev=minimax(board,depth-1,float('-inf'),float('inf'),True)
            board.pop()
            if ev<be:
                be=ev
                cm=move
        return cm

def get_best_move(fen_str:str,depth:int=3):
    try:
        board=chess.Board(fen_str)
    except ValueError as e:
        raise ValueError("Invalid FEN string.")from e
    if board.is_game_over():
        return{"updated_fen":board.fen(),"result":board.result()}
    m=best_move(board,depth)
    if m is None:
        raise ValueError("No valid moves found.")
    board.push(m)
    return{"updated_fen":board.fen(),"result":board.result()}

@app.post("/")
async def fen_endpoint(value:str):
    try:
        return get_best_move(value)
    except ValueError as e:
        raise HTTPException(status_code=400,detail=str(e))
