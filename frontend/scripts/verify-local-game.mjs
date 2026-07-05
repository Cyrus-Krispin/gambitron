import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Chess } from "chess.js";

const root = process.cwd();
const outdir = await mkdtemp(path.join(tmpdir(), "gambitron-local-game-"));
const entry = path.join(outdir, "entry.ts");
const outfile = path.join(outdir, "entry.mjs");

await writeFile(
  entry,
  `export { createLocalGameSocket } from ${JSON.stringify(path.join(root, "src/lib/localGameSocket.ts"))};\n`
);

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  alias: {
    "@": path.join(root, "src"),
  },
});

globalThis.window = {
  setTimeout,
  setInterval,
  clearInterval,
};
globalThis.WebSocket = class WebSocketShim {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
};

const { createLocalGameSocket } = await import(pathToFileURL(outfile).href);

function waitFor(messages, predicate, label, startIndex = 0) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const match = messages.slice(startIndex).find(predicate);
      if (match) {
        resolve(match);
        return;
      }
      if (Date.now() - started > 2500) {
        reject(new Error(`Timed out waiting for ${label}. Messages: ${JSON.stringify(messages)}`));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

const messages = [];
const socket1 = createLocalGameSocket((msg) => messages.push(msg), () => {
  socket1.send(JSON.stringify({
    type: "start_game",
    timeControlMs: 300000,
    incrementMs: 0,
    playerColor: "white",
  }));
});

const started = await waitFor(messages, (msg) => msg.type === "game_started", "game_started");
socket1.close();

const socket2 = createLocalGameSocket((msg) => messages.push(msg), () => {
  socket2.send(JSON.stringify({ type: "subscribe", gameId: started.gameId }));
});

await waitFor(messages, (msg) => msg.type === "game_state" && msg.gameId === started.gameId, "game_state after reconnect");

const chess = new Chess(started.fen);
let lastIndex = messages.length;
let lastPlayerMove = null;
for (let turn = 0; turn < 3; turn++) {
  const legal = chess.moves({ verbose: true })[0];
  lastPlayerMove = chess.move({ from: legal.from, to: legal.to, promotion: legal.promotion });
  socket2.send(JSON.stringify({
    type: "player_move",
    gameId: started.gameId,
    fen: chess.fen(),
    san: lastPlayerMove.san,
    from: lastPlayerMove.from,
    to: lastPlayerMove.to,
  }));

  const aiMove = await waitFor(messages, (msg) => msg.type === "ai_move", `ai_move ${turn + 1} after player move`, lastIndex);
  if (!aiMove.updatedFen || !aiMove.fromSquare || !aiMove.toSquare) {
    throw new Error(`Invalid ai_move payload: ${JSON.stringify(aiMove)}`);
  }
  chess.load(aiMove.updatedFen);
  lastIndex = messages.length;
}

socket2.close();

const blackMessages = [];
const blackSocket1 = createLocalGameSocket((msg) => blackMessages.push(msg), () => {
  blackSocket1.send(JSON.stringify({
    type: "start_game",
    timeControlMs: 300000,
    incrementMs: 0,
    playerColor: "black",
  }));
});
const blackStarted = await waitFor(blackMessages, (msg) => msg.type === "game_started", "black game_started");
blackSocket1.send(JSON.stringify({ type: "request_ai_move", gameId: blackStarted.gameId, fen: blackStarted.fen }));
blackSocket1.close();

const blackSocket2 = createLocalGameSocket((msg) => blackMessages.push(msg), () => {
  blackSocket2.send(JSON.stringify({ type: "subscribe", gameId: blackStarted.gameId }));
});
const openingAiMove = await waitFor(blackMessages, (msg) => msg.type === "ai_move", "opening ai_move after black reconnect");
if (!openingAiMove.updatedFen || !openingAiMove.fromSquare || !openingAiMove.toSquare) {
  throw new Error(`Invalid black opening ai_move payload: ${JSON.stringify(openingAiMove)}`);
}
blackSocket2.close();

console.log(`local game socket ok: white line through ${lastPlayerMove.san}; black starts with ${openingAiMove.san ?? `${openingAiMove.fromSquare}${openingAiMove.toSquare}`}`);
