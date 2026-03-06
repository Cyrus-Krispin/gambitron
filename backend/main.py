"""Gambitron FastAPI backend."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from chess_engine import get_best_move

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/")
async def fen_endpoint(value: str):
    try:
        return get_best_move(value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
