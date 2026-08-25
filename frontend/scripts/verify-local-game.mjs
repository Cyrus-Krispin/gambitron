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
  localStorage: {
    getItem(key) {
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      this.values.set(key, String(value));
    },
    removeItem(key) {
      this.values.delete(key);
    },
    values: new Map(),
  },
};
globalThis.WebSocket = class WebSocketShim {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
};

const moduleUrl = pathToFileURL(outfile).href;
const { createLocalGameSocket } = await import(`${moduleUrl}?instance=1`);

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

const reloadedModule = await import(`${moduleUrl}?instance=2`);
const socket2 = reloadedModule.createLocalGameSocket((msg) => messages.push(msg), () => {
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

const secondReload = await import(`${moduleUrl}?instance=3`);
const recoveredMessages = [];
const recoveredSocket = secondReload.createLocalGameSocket((msg) => recoveredMessages.push(msg), () => {
  recoveredSocket.send(JSON.stringify({ type: "subscribe", gameId: started.gameId }));
});
const recovered = await waitFor(
  recoveredMessages,
  (msg) => msg.type === "game_state" && msg.gameId === started.gameId,
  "game_state after page reload",
);
if (recovered.fen !== chess.fen() || recovered.moves?.length !== 6) {
  throw new Error(`Reload did not restore the full game: ${JSON.stringify(recovered)}`);
}
recoveredSocket.close();

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
blackSocket1.close();

const blackReload = await import(`${moduleUrl}?instance=4`);
const blackSocket2 = blackReload.createLocalGameSocket((msg) => blackMessages.push(msg), () => {
  blackSocket2.send(JSON.stringify({ type: "subscribe", gameId: blackStarted.gameId }));
});
const openingAiMove = await waitFor(blackMessages, (msg) => msg.type === "ai_move", "opening ai_move after black reconnect");
if (!openingAiMove.updatedFen || !openingAiMove.fromSquare || !openingAiMove.toSquare) {
  throw new Error(`Invalid black opening ai_move payload: ${JSON.stringify(openingAiMove)}`);
}
blackSocket2.close();

const terminalGameId = "terminal-player-move";
const beforeMate = new Chess();
const terminalMoves = ["f3", "e5", "g4"].map((san) => {
  const move = beforeMate.move(san);
  return {
    color: move.color,
    san: move.san,
    from: move.from,
    to: move.to,
    captured: move.captured,
    promotion: move.promotion,
  };
});
window.localStorage.setItem("gambitron.activeGames.v1", JSON.stringify([{
  gameId: terminalGameId,
  fen: beforeMate.fen(),
  playerColor: "black",
  timeControlMs: 300000,
  incrementMs: 0,
  playerTimeMs: 290000,
  aiTimeMs: 290000,
  activeClock: "player",
  lastTick: 0,
  moves: terminalMoves,
  persistedAt: Date.now(),
}]));

const terminalModule = await import(`${moduleUrl}?instance=5`);
const terminalMessages = [];
const terminalSocket = terminalModule.createLocalGameSocket((msg) => terminalMessages.push(msg), () => {
  terminalSocket.send(JSON.stringify({ type: "subscribe", gameId: terminalGameId }));
});
await waitFor(terminalMessages, (msg) => msg.type === "game_state", "terminal setup state");
const mate = beforeMate.move("Qh4#");
terminalSocket.send(JSON.stringify({
  type: "player_move",
  gameId: terminalGameId,
  fen: beforeMate.fen(),
  san: mate.san,
  from: mate.from,
  to: mate.to,
}));
const terminalResult = await waitFor(
  terminalMessages,
  (msg) => msg.type === "game_ended",
  "player terminal result",
);
if (terminalResult.result !== "0-1" || terminalResult.termination !== "checkmate") {
  throw new Error(`Incorrect terminal result: ${JSON.stringify(terminalResult)}`);
}
terminalSocket.close();

const terminalReloadModule = await import(`${moduleUrl}?instance=6`);
const terminalReloadMessages = [];
const terminalReloadSocket = terminalReloadModule.createLocalGameSocket(
  (msg) => terminalReloadMessages.push(msg),
  () => terminalReloadSocket.send(JSON.stringify({ type: "subscribe", gameId: terminalGameId })),
);
const terminalReloaded = await waitFor(
  terminalReloadMessages,
  (msg) => msg.type === "game_state",
  "terminal game after reload",
);
if (
  terminalReloaded.fen !== beforeMate.fen() ||
  terminalReloaded.moves?.length !== 4 ||
  terminalReloaded.result !== "0-1" ||
  terminalReloaded.termination !== "checkmate"
) {
  throw new Error(`Terminal reload regressed: ${JSON.stringify(terminalReloaded)}`);
}
terminalReloadSocket.close();

const timeoutMessages = [];
const timeoutSocket = createLocalGameSocket((msg) => timeoutMessages.push(msg), () => {
  timeoutSocket.send(JSON.stringify({
    type: "start_game",
    timeControlMs: 25,
    incrementMs: 0,
    playerColor: "white",
  }));
});
const timeoutStarted = await waitFor(timeoutMessages, (msg) => msg.type === "game_started", "timeout game start");
const timedOut = await waitFor(
  timeoutMessages,
  (msg) => msg.type === "game_ended" && msg.gameId === timeoutStarted.gameId,
  "live timeout",
);
if (timedOut.result !== "0-1" || timedOut.termination !== "timeout") {
  throw new Error(`Incorrect timeout: ${JSON.stringify(timedOut)}`);
}
timeoutSocket.close();

const timeoutReloadModule = await import(`${moduleUrl}?instance=7`);
const timeoutReloadMessages = [];
const timeoutReloadSocket = timeoutReloadModule.createLocalGameSocket(
  (msg) => timeoutReloadMessages.push(msg),
  () => timeoutReloadSocket.send(JSON.stringify({ type: "subscribe", gameId: timeoutStarted.gameId })),
);
const timeoutReloaded = await waitFor(
  timeoutReloadMessages,
  (msg) => msg.type === "game_state" && msg.gameId === timeoutStarted.gameId,
  "timeout after reload",
);
if (
  timeoutReloaded.playerTimeMs !== 0 ||
  timeoutReloaded.result !== "0-1" ||
  timeoutReloaded.termination !== "timeout"
) {
  throw new Error(`Timeout reload regressed: ${JSON.stringify(timeoutReloaded)}`);
}
timeoutReloadSocket.close();

console.log(`local game socket ok: white line through ${lastPlayerMove.san}; black starts with ${openingAiMove.san ?? `${openingAiMove.fromSquare}${openingAiMove.toSquare}`}; terminal reload preserved ${mate.san}; timeout reload preserved 0-1`);
