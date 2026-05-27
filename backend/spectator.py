import json
import sys
from pathlib import Path

import chess
import chess.svg
from http.server import HTTPServer, BaseHTTPRequestHandler

STATE_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/tournament_state.json")
PORT = 8080

MOVE_HIGHLIGHT = "#ffd70060"
BOARD_COLORS = {"square light": "#edeed1", "square dark": "#779952"}

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Engine Tournament</title>
<style>
  * { box-sizing:border-box; }
  body { background:#1a1a2e; color:#e0e0e0; font-family:system-ui; margin:0;
         display:flex; min-height:100vh; }
  .main { flex:1; display:flex; flex-direction:column; align-items:center;
          padding:24px; gap:16px; }
  .board-container { position:relative; }
  .board-container img { max-width:540px; display:block; }
  h1 { font-size:20px; text-align:center; margin:0; }
  .info { text-align:center; font-size:14px; color:#888; }
  .sidebar { width:300px; background:#16213e; border-left:1px solid #0f3460;
             display:flex; flex-direction:column; overflow:hidden; }
  .sidebar h2 { font-size:16px; padding:16px; margin:0; border-bottom:1px solid #0f3460; }
  .moves { flex:1; overflow-y:auto; padding:8px; font-family:monospace; font-size:13px; }
  .move-pair { display:flex; gap:8px; padding:2px 0; }
  .move-num { color:#555; min-width:32px; text-align:right; }
  .move { min-width:48px; }
  .move.last { background:#ffd70030; border-radius:3px; padding:0 4px; }
  .results { border-top:1px solid #0f3460; padding:16px; }
  .results table { width:100%; border-collapse:collapse; }
  .results td:last-child { text-align:right; font-weight:bold; }
  .status { text-align:center; font-size:14px; padding:8px 16px;
            border-bottom:1px solid #0f3460; }
  .controls { padding:12px 16px; border-top:1px solid #0f3460; display:flex; gap:8px; }
  button { background:#0f3460; color:#e0e0e0; border:none; padding:6px 12px;
           border-radius:4px; cursor:pointer; font-size:13px; }
  button:hover { background:#1a4a8a; }
</style>
</head>
<body>
<div class="main">
  <h1>Engine Tournament</h1>
  <div class="board-container" id="board"></div>
  <div class="info" id="info"></div>
</div>
<div class="sidebar">
  <div class="status" id="status">Waiting for tournament...</div>
  <h2>Move List</h2>
  <div class="moves" id="moves"></div>
  <div class="results" id="results"></div>
</div>
<script>
const POLL_MS = 600;
let lastFen = "";

async function poll() {
  try {
    const r = await fetch("/state");
    if (!r.ok) return;
    const s = await r.json();

    // update game info
    const infoEl = document.getElementById("info");
    infoEl.textContent = s.game || "";
    const statusEl = document.getElementById("status");
    statusEl.textContent = s.game || "Waiting...";

    // update board
    if (s.fen && s.fen !== lastFen && s.board_svg) {
      document.getElementById("board").innerHTML = s.board_svg;
      lastFen = s.fen;
    }

    // update move list
    if (s.move_list) {
      const movesEl = document.getElementById("moves");
      let html = "";
      const lines = s.move_list;
      for (let i = 0; i < lines.length; i += 2) {
        const n = Math.floor(i / 2) + 1;
        const w = lines[i] || "";
        const b = lines[i + 1] || "";
        html += `<div class="move-pair">
          <span class="move-num">${n}.</span>
          <span class="move${i === lines.length - 1 ? ' last' : ''}">${w}</span>
          <span class="move${i + 1 === lines.length - 1 ? ' last' : ''}">${b}</span>
        </div>`;
      }
      movesEl.innerHTML = html;
      movesEl.scrollTop = movesEl.scrollHeight;
    }

    // update results
    if (s.results) {
      const rEl = document.getElementById("results");
      let html = '<table>';
      for (const [k, v] of Object.entries(s.results)) {
        html += `<tr><td>${k}</td><td>${v}</td></tr>`;
      }
      html += '</table>';
      rEl.innerHTML = html;
    }
  } catch(e) {}
}

setInterval(poll, POLL_MS);
poll();
</script>
</body>
</html>"""


def _render_board(fen, highlight_squares=None):
    if not highlight_squares:
        highlight_squares = []
    try:
        board = chess.Board(fen)
        kwargs = {"size": 520}
        if highlight_squares:
            kwargs["fill"] = {sq: MOVE_HIGHLIGHT for sq in highlight_squares}
            kwargs["lastmove"] = highlight_squares[0]  # triggers python-chess arrow
        else:
            kwargs["lastmove"] = None
        return chess.svg.board(board, **kwargs)
    except Exception:
        return '<p style="color:#888;text-align:center;">Invalid position</p>'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/state":
            return self._serve_state()
        return self._serve_page()

    def _serve_state(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if STATE_FILE.exists():
            data = json.loads(STATE_FILE.read_text())
        else:
            data = {}
        fen = data.get("fen", "")
        if fen:
            data["board_svg"] = _render_board(fen)
        self.wfile.write(json.dumps(data).encode())

    def _serve_page(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML.encode())

    def log_message(self, fmt, *args):
        pass


def main():
    server = HTTPServer(("", PORT), Handler)
    print(f"Spectator ready at http://localhost:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
