"""WebSocket connection manager: track game subscriptions and broadcast."""
import uuid

from fastapi import WebSocket


# game_id -> set of WebSocket connections
_subscriptions: dict[uuid.UUID, set[WebSocket]] = {}
# ws -> set of game_ids (for cleanup on disconnect)
_ws_games: dict[WebSocket, set[uuid.UUID]] = {}


def subscribe(ws: WebSocket, game_id: uuid.UUID) -> None:
    """Subscribe a WebSocket to a game. Receives time_update and game_ended for that game."""
    if game_id not in _subscriptions:
        _subscriptions[game_id] = set()
    _subscriptions[game_id].add(ws)
    if ws not in _ws_games:
        _ws_games[ws] = set()
    _ws_games[ws].add(game_id)


def unsubscribe(ws: WebSocket, game_id: uuid.UUID) -> None:
    """Unsubscribe a WebSocket from a game."""
    if game_id in _subscriptions:
        _subscriptions[game_id].discard(ws)
        if not _subscriptions[game_id]:
            del _subscriptions[game_id]
    if ws in _ws_games:
        _ws_games[ws].discard(game_id)


def on_disconnect(ws: WebSocket) -> None:
    """Remove WebSocket from all subscriptions. Call when client disconnects."""
    games = _ws_games.pop(ws, set())
    for gid in games:
        if gid in _subscriptions:
            _subscriptions[gid].discard(ws)
            if not _subscriptions[gid]:
                del _subscriptions[gid]


async def broadcast_to_game(game_id: uuid.UUID, msg: dict) -> None:
    """Send msg to all WebSockets subscribed to game_id."""
    subs = _subscriptions.get(game_id, set()).copy()
    dead: list[WebSocket] = []
    for ws in subs:
        try:
            await ws.send_json(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        unsubscribe(ws, game_id)
