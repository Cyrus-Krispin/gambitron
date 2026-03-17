"""Gambitron FastAPI backend."""
import asyncio
import json
import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from chess_engine import get_best_move
from config import ALLOWED_ORIGINS
from db.connection import close_pool, create_pool, get_connection_error, get_pool
from db import games as games_db
from db import moves as moves_db
from websocket import connection_manager
from websocket import timers as timers_module
from websocket.handlers import handle_message

app = FastAPI()
_timer_task: asyncio.Task | None = None
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _timer_loop():
    """Background task: tick game timers every 100ms, broadcast time_update."""
    while True:
        await asyncio.sleep(0.1)
        await timers_module.tick_all(connection_manager.broadcast_to_game)


@app.on_event("startup")
async def startup():
    global _timer_task
    await create_pool()
    _timer_task = asyncio.create_task(_timer_loop())


@app.on_event("shutdown")
async def shutdown():
    global _timer_task
    if _timer_task:
        _timer_task.cancel()
        try:
            await _timer_task
        except asyncio.CancelledError:
            pass
    await close_pool()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
async def db_check():
    """Verify DB connection and whether games table exists."""
    pool = get_pool()
    if not pool:
        reason = get_connection_error() or "DATABASE_URL not set or pool not created"
        return {
            "connected": False,
            "reason": reason,
            "tables": {"games": False},
            "games_count": None,
        }
    try:
        async with pool.acquire() as conn:
            tables = await conn.fetch(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'games'
                """
            )
            found = {r["table_name"] for r in tables}
            count = None
            if "games" in found:
                count = await conn.fetchval("SELECT COUNT(*) FROM games")
            return {
                "connected": True,
                "tables": {"games": "games" in found},
                "games_count": count,
            }
    except Exception as e:
        return {
            "connected": False,
            "reason": str(e),
            "tables": {"games": False},
            "games_count": None,
        }


@app.post("/")
async def fen_endpoint(value: str):
    """Legacy REST endpoint for FEN → AI move (backward compatibility)."""
    try:
        return get_best_move(value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            response = await handle_message(ws, raw)
            if response:
                await ws.send_json(response)
    except WebSocketDisconnect:
        connection_manager.on_disconnect(ws)


@app.get("/games")
async def list_games(limit: int = 20, offset: int = 0, has_pgn: bool | None = None):
    """List games. Set has_pgn=true to only return games with valid PGN."""
    games, total = await games_db.list_games(limit=limit, offset=offset, has_pgn=has_pgn)
    return {"games": games, "total": total}


@app.get("/games/{game_id}")
async def get_game(game_id: str):
    try:
        gid = uuid.UUID(game_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid game ID")
    game = await games_db.get_game(gid)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@app.get("/games/{game_id}/moves")
async def get_game_moves(game_id: str):
    try:
        gid = uuid.UUID(game_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid game ID")
    moves = await moves_db.get_moves_by_game(gid)
    return {"moves": moves}
