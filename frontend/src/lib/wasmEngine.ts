import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";

export interface SearchDiagnostics {
  depth: number;
  nodes: number;
  score: number;
  elapsedMs: number;
  nps: number;
  timedOut: boolean;
}

export interface LocalAIMoveResult {
  updated_fen?: string;
  result: string;
  termination?: string;
  captured?: string;
  move?: {
    from?: string;
    to?: string;
    san?: string;
    promotion?: string;
  };
  search?: SearchDiagnostics;
}

export interface EngineOptions {
  maxDepth?: number;
  timeLimitMs?: number;
}

type WasmEngineExports = {
  score: (pieceValue: number, sign: number) => number;
};

type Bound = "exact" | "lower" | "upper";

type TranspositionEntry = {
  depth: number;
  score: number;
  flag: Bound;
  bestMove?: string;
};

type SearchContext = {
  deadline: number;
  startedAt: number;
  nodes: number;
  completedDepth: number;
  timedOut: boolean;
  tt: Map<string, TranspositionEntry>;
  killers: Map<number, string[]>;
  history: Map<string, number>;
};

class SearchTimeout extends Error {}

const WASM_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x09, 0x01, 0x05, 0x73, 0x63, 0x6f, 0x72, 0x65, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6c, 0x0b,
]);

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const MATE_SCORE = 100_000;
const MATE_BOUND = MATE_SCORE - 1_000;
const INFINITY = 1_000_000_000;
const MAX_SEARCH_MS = 450;
const DEFAULT_MAX_DEPTH = 7;
const MAX_QUIESCENCE_DEPTH = 7;
const ASPIRATION_WINDOW = 50;
const TIME_CHECK_INTERVAL = 64;

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

function moveKey(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function historyKey(game: Chess, move: Move): string {
  return `${game.turn()}:${moveKey(move)}`;
}

function isTactical(move: Move): boolean {
  return Boolean(move.captured || move.promotion || move.san.includes("+"));
}

function materialScore(game: Chess, wasm: WasmEngineExports): number {
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      score += wasm.score(PIECE_VALUES[piece.type], piece.color === "w" ? 1 : -1);
    }
  }
  return score;
}

function positionalScore(game: Chess): number {
  let score = 0;
  const board = game.board();
  let whiteBishops = 0;
  let blackBishops = 0;

  for (let rank = 0; rank < board.length; rank += 1) {
    for (let file = 0; file < board[rank].length; file += 1) {
      const piece = board[rank][file];
      if (!piece) continue;

      const sign = piece.color === "w" ? 1 : -1;
      const rankFromWhite = 7 - rank;
      const relativeRank = piece.color === "w" ? rankFromWhite : 7 - rankFromWhite;
      const centerDistance = Math.abs(file - 3.5) + Math.abs(rank - 3.5);

      if (piece.type === "p") score += sign * (relativeRank * 7 - Math.floor(centerDistance * 2));
      if (piece.type === "n" || piece.type === "b") score += sign * Math.round(18 - centerDistance * 4);
      if (piece.type === "r" && relativeRank === 6) score += sign * 18;
      if (piece.type === "b") {
        if (piece.color === "w") whiteBishops += 1;
        else blackBishops += 1;
      }
    }
  }

  if (whiteBishops >= 2) score += 35;
  if (blackBishops >= 2) score -= 35;
  return score;
}

function evaluate(game: Chess, wasm: WasmEngineExports): number {
  if (game.isCheckmate()) return -MATE_SCORE;
  if (game.isDraw()) return 0;

  const whiteScore = materialScore(game, wasm) + positionalScore(game);
  const mobility = game.moves().length * 2;
  return game.turn() === "w" ? whiteScore + mobility : -whiteScore + mobility;
}

function checkTime(ctx: SearchContext): void {
  ctx.nodes += 1;
  if ((ctx.nodes === 1 || ctx.nodes % TIME_CHECK_INTERVAL === 0) && performance.now() >= ctx.deadline) {
    throw new SearchTimeout();
  }
}

function rememberKiller(ctx: SearchContext, ply: number, move: Move): void {
  const key = moveKey(move);
  const killers = ctx.killers.get(ply) ?? [];
  if (killers.includes(key)) return;
  killers.unshift(key);
  ctx.killers.set(ply, killers.slice(0, 2));
}

function movePriority(game: Chess, move: Move, ctx: SearchContext, ply: number, ttMove?: string): number {
  const key = moveKey(move);
  if (ttMove === key) return 10_000_000;

  let score = 0;
  if (move.captured) {
    score += 1_000_000 + (PIECE_VALUES[move.captured] * 16) - PIECE_VALUES[move.piece];
  } else {
    const killers = ctx.killers.get(ply) ?? [];
    if (key === killers[0]) score += 900_000;
    else if (key === killers[1]) score += 800_000;
    score += ctx.history.get(historyKey(game, move)) ?? 0;
  }
  if (move.promotion) score += 700_000 + PIECE_VALUES[move.promotion];
  if (move.san.includes("+")) score += 60_000;
  if (move.san === "O-O" || move.san === "O-O-O") score += 15_000;
  return score;
}

function orderedMoves(
  game: Chess,
  ctx: SearchContext,
  ply: number,
  ttMove?: string,
  tacticalOnly = false,
): Move[] {
  const moves = game.moves({ verbose: true }) as Move[];
  const filtered = tacticalOnly ? moves.filter(isTactical) : moves;
  return filtered.sort((left, right) => (
    movePriority(game, right, ctx, ply, ttMove) - movePriority(game, left, ctx, ply, ttMove)
  ));
}

function quiescence(
  game: Chess,
  alpha: number,
  beta: number,
  ply: number,
  depth: number,
  wasm: WasmEngineExports,
  ctx: SearchContext,
): number {
  checkTime(ctx);
  if (game.isGameOver()) return evaluate(game, wasm);

  const standPat = evaluate(game, wasm);
  if (standPat >= beta) return standPat;
  let best = Math.max(alpha, standPat);
  if (depth >= MAX_QUIESCENCE_DEPTH) return best;

  const moves = game.isCheck()
    ? orderedMoves(game, ctx, ply)
    : orderedMoves(game, ctx, ply, undefined, true);
  for (const move of moves) {
    game.move({ from: move.from as Square, to: move.to as Square, promotion: move.promotion });
    try {
      const score = -quiescence(game, -beta, -best, ply + 1, depth + 1, wasm, ctx);
      if (score >= beta) return score;
      best = Math.max(best, score);
    } finally {
      game.undo();
    }
  }
  return best;
}

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  wasm: WasmEngineExports,
  ctx: SearchContext,
): number {
  checkTime(ctx);
  if (game.isGameOver()) return evaluate(game, wasm);
  if (depth <= 0) return quiescence(game, alpha, beta, ply, 0, wasm, ctx);

  const alphaOriginal = alpha;
  const betaOriginal = beta;
  const position = game.fen();
  const entry = ctx.tt.get(position);
  if (entry && entry.depth >= depth) {
    if (entry.flag === "exact") return entry.score;
    if (entry.flag === "lower") alpha = Math.max(alpha, entry.score);
    if (entry.flag === "upper") beta = Math.min(beta, entry.score);
    if (alpha >= beta) return entry.score;
  }

  let bestScore = -INFINITY;
  let bestMove: Move | undefined;
  const moves = orderedMoves(game, ctx, ply, entry?.bestMove);
  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    game.move({ from: move.from as Square, to: move.to as Square, promotion: move.promotion });
    try {
      let score: number;
      if (index === 0) {
        score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, wasm, ctx);
      } else {
        score = -negamax(game, depth - 1, -alpha - 1, -alpha, ply + 1, wasm, ctx);
        if (alpha < score && score < beta) {
          score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, wasm, ctx);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) {
        if (!move.captured && !move.promotion) {
          rememberKiller(ctx, ply, move);
          const key = historyKey(game, move);
          ctx.history.set(key, (ctx.history.get(key) ?? 0) + depth * depth);
        }
        break;
      }
    } finally {
      game.undo();
    }
  }

  const flag: Bound = bestScore <= alphaOriginal ? "upper" : bestScore >= betaOriginal ? "lower" : "exact";
  if (bestMove) ctx.tt.set(position, { depth, score: bestScore, flag, bestMove: moveKey(bestMove) });
  return bestScore;
}

function searchRoot(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  wasm: WasmEngineExports,
  ctx: SearchContext,
  previousBest?: string,
): { score: number; move?: Move } {
  let bestScore = -INFINITY;
  let bestMove: Move | undefined;
  for (const [index, move] of orderedMoves(game, ctx, 0, previousBest).entries()) {
    game.move({ from: move.from as Square, to: move.to as Square, promotion: move.promotion });
    try {
      let score: number;
      if (index === 0) {
        score = -negamax(game, depth - 1, -beta, -alpha, 1, wasm, ctx);
      } else {
        score = -negamax(game, depth - 1, -alpha - 1, -alpha, 1, wasm, ctx);
        if (alpha < score && score < beta) score = -negamax(game, depth - 1, -beta, -alpha, 1, wasm, ctx);
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    } finally {
      game.undo();
    }
  }
  return { score: bestScore, move: bestMove };
}

function searchIteration(
  game: Chess,
  depth: number,
  previousScore: number,
  wasm: WasmEngineExports,
  ctx: SearchContext,
  previousBest?: string,
): { score: number; move?: Move } {
  if (depth === 1 || Math.abs(previousScore) >= MATE_BOUND) {
    return searchRoot(game, depth, -INFINITY, INFINITY, wasm, ctx, previousBest);
  }
  const alpha = Math.max(-INFINITY, previousScore - ASPIRATION_WINDOW);
  const beta = Math.min(INFINITY, previousScore + ASPIRATION_WINDOW);
  const result = searchRoot(game, depth, alpha, beta, wasm, ctx, previousBest);
  return result.score <= alpha || result.score >= beta
    ? searchRoot(game, depth, -INFINITY, INFINITY, wasm, ctx, previousBest)
    : result;
}

function diagnostics(ctx: SearchContext, score: number): SearchDiagnostics {
  const elapsedMs = Math.max(performance.now() - ctx.startedAt, 0.001);
  return {
    depth: ctx.completedDepth,
    nodes: ctx.nodes,
    score,
    elapsedMs: Math.round(elapsedMs * 10) / 10,
    nps: Math.round(ctx.nodes / (elapsedMs / 1_000)),
    timedOut: ctx.timedOut,
  };
}

export async function calculateAIMove(fen: string, options: EngineOptions = {}): Promise<LocalAIMoveResult> {
  const game = new Chess(fen);
  const current = getResult(game);
  if (current.result !== "*") return current;

  const wasm = await loadWasmEngine();
  const startedAt = performance.now();
  const ctx: SearchContext = {
    startedAt,
    deadline: startedAt + Math.max(10, options.timeLimitMs ?? MAX_SEARCH_MS),
    nodes: 0,
    completedDepth: 0,
    timedOut: false,
    tt: new Map(),
    killers: new Map(),
    history: new Map(),
  };

  const rootMoves = orderedMoves(game, ctx, 0);
  let bestMove = rootMoves[0];
  let bestScore = evaluate(game, wasm);
  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    try {
      const result = searchIteration(game, depth, bestScore, wasm, ctx, bestMove && moveKey(bestMove));
      if (result.move) {
        bestMove = result.move;
        bestScore = result.score;
        ctx.completedDepth = depth;
      }
    } catch (error) {
      if (!(error instanceof SearchTimeout)) throw error;
      ctx.timedOut = true;
      break;
    }
  }

  if (!bestMove) return { ...current, search: diagnostics(ctx, bestScore) };
  const played = game.move({ from: bestMove.from as Square, to: bestMove.to as Square, promotion: bestMove.promotion });
  const end = getResult(game);
  return {
    updated_fen: game.fen(),
    result: end.result,
    termination: end.termination,
    captured: played.captured,
    move: { from: played.from, to: played.to, san: played.san, promotion: played.promotion },
    search: diagnostics(ctx, bestScore),
  };
}
