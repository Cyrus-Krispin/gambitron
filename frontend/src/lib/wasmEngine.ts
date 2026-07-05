import { Chess, type Move } from "chess.js";

export interface LocalAIMoveResult {
  updated_fen?: string;
  result: string;
  termination?: string;
  captured?: string;
  move?: {
    from?: string;
    to?: string;
    san?: string;
  };
}

type WasmEngineExports = {
  score: (pieceValue: number, sign: number) => number;
};

const WASM_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x09, 0x01, 0x05, 0x73, 0x63, 0x6f, 0x72, 0x65, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6c, 0x0b,
]);

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const MATE_SCORE = 100_000;
const MAX_SEARCH_MS = 450;

let enginePromise: Promise<WasmEngineExports> | null = null;

function getResult(game: Chess): { result: string; termination?: string } {
  if (!game.isGameOver()) return { result: "*" };
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    return { result: winner === "w" ? "1-0" : "0-1", termination: "checkmate" };
  }
  return { result: "1/2-1/2", termination: "draw" };
}

async function loadWasmEngine(): Promise<WasmEngineExports> {
  enginePromise ??= WebAssembly.instantiate(WASM_BYTES).then(({ instance }) => {
    return instance.exports as WasmEngineExports;
  });
  return enginePromise;
}

function materialScore(game: Chess, wasm: WasmEngineExports): number {
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      score += wasm.score(PIECE_VALUES[piece.type] ?? 0, piece.color === "w" ? 1 : -1);
    }
  }
  return score;
}

function evaluate(game: Chess, wasm: WasmEngineExports): number {
  if (game.isCheckmate()) return -MATE_SCORE;
  if (game.isDraw()) return 0;

  const whiteToMove = game.turn() === "w";
  const material = materialScore(game, wasm);
  const mobility = game.moves().length * 2;
  const perspective = whiteToMove ? 1 : -1;
  return material * perspective + mobility;
}

function movePriority(move: Move): number {
  let score = 0;
  if (move.captured) score += 10_000 + (PIECE_VALUES[move.captured] ?? 0) - (PIECE_VALUES[move.piece] ?? 0);
  if (move.promotion) score += 8_000 + (PIECE_VALUES[move.promotion] ?? 0);
  if (move.san.includes("+")) score += 500;
  if (move.san.includes("#")) score += 50_000;
  return score;
}

function search(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  wasm: WasmEngineExports,
  deadline: number
): number {
  if (performance.now() >= deadline || depth === 0 || game.isGameOver()) {
    return evaluate(game, wasm);
  }

  const moves = (game.moves({ verbose: true }) as Move[]).sort((a, b) => movePriority(b) - movePriority(a));
  if (moves.length === 0) return evaluate(game, wasm);

  let best = -Infinity;
  for (const move of moves) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = -search(game, depth - 1, -beta, -alpha, wasm, deadline);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export async function calculateAIMove(fen: string): Promise<LocalAIMoveResult> {
  const game = new Chess(fen);
  const current = getResult(game);
  if (current.result !== "*") return current;

  const wasm = await loadWasmEngine();
  const moves = (game.moves({ verbose: true }) as Move[]).sort((a, b) => movePriority(b) - movePriority(a));
  const depth = moves.length > 28 ? 2 : 3;
  const deadline = performance.now() + MAX_SEARCH_MS;
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = -search(game, depth - 1, -Infinity, Infinity, wasm, deadline);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (performance.now() >= deadline) break;
  }

  const played = game.move({ from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion });
  const end = getResult(game);
  return {
    updated_fen: game.fen(),
    result: end.result,
    termination: end.termination,
    captured: played.captured,
    move: {
      from: played.from,
      to: played.to,
      san: played.san,
    },
  };
}
