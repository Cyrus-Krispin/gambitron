import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { getGameOutcome } from "./gameOutcome";
import { getOpeningBookMove } from "./openingBook";

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
  nodeLimit?: number;
  remainingTimeMs?: number;
  incrementMs?: number;
  positionCounts?: Readonly<Record<string, number>>;
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
  minimumDepth: number;
  nodeLimit?: number;
  startedAt: number;
  nodes: number;
  completedDepth: number;
  timedOut: boolean;
  tt: Map<string, TranspositionEntry>;
  killers: Map<number, string[]>;
  history: Map<string, number>;
  repetitionCounts: Map<string, number>;
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
const MAX_SEARCH_MS = 2_000;
const DEFAULT_MAX_DEPTH = 7;
const MINIMUM_COMPLETED_DEPTH = 3;
const MAX_QUIESCENCE_DEPTH = 4;
const ASPIRATION_WINDOW = 50;
const TIME_CHECK_INTERVAL = 64;
const MIN_SEARCH_MS = 750;
const MAX_SEARCH_ALLOCATION_MS = 4_500;
const CASTLED_KING_BONUS = 45;
const CASTLING_RIGHT_BONUS = 12;
const LOST_CASTLING_PENALTY = 35;
const EARLY_KING_MOVE_PENALTY = 45;

let enginePromise: Promise<WasmEngineExports> | null = null;

async function loadWasmEngine(): Promise<WasmEngineExports> {
  enginePromise ??= WebAssembly.instantiate(WASM_BYTES).then(({ instance }) => {
    return instance.exports as WasmEngineExports;
  });
  return enginePromise;
}

function moveKey(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function positionKey(game: Chess): string {
  return game.fen().split(" ").slice(0, 4).join(" ");
}

function transpositionKey(game: Chess): string {
  return game.fen().split(" ").slice(0, 5).join(" ");
}

function repetitionCount(game: Chess, ctx: SearchContext): number {
  return ctx.repetitionCounts.get(positionKey(game)) ?? 0;
}

function playSearchMove(game: Chess, move: Move, ctx: SearchContext): void {
  game.move({ from: move.from as Square, to: move.to as Square, promotion: move.promotion });
  const key = positionKey(game);
  ctx.repetitionCounts.set(key, (ctx.repetitionCounts.get(key) ?? 0) + 1);
}

function undoSearchMove(game: Chess, ctx: SearchContext): void {
  const key = positionKey(game);
  const count = ctx.repetitionCounts.get(key) ?? 0;
  if (count <= 1) ctx.repetitionCounts.delete(key);
  else ctx.repetitionCounts.set(key, count - 1);
  game.undo();
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
  const pawnFiles = { w: Array<number>(8).fill(0), b: Array<number>(8).fill(0) };
  const pawns: Array<{ color: "w" | "b"; rank: number; file: number; relativeRank: number }> = [];
  const kings: Partial<Record<"w" | "b", { rank: number; file: number; relativeRank: number }>> = {};
  let whiteUndevelopedMinors = 0;
  let blackUndevelopedMinors = 0;
  const [, , castlingRights, , , fullmoveText] = game.fen().split(" ");
  const fullmoveNumber = Number(fullmoveText);

  for (let rank = 0; rank < board.length; rank += 1) {
    for (let file = 0; file < board[rank].length; file += 1) {
      const piece = board[rank][file];
      if (!piece) continue;

      const sign = piece.color === "w" ? 1 : -1;
      const rankFromWhite = 7 - rank;
      const relativeRank = piece.color === "w" ? rankFromWhite : 7 - rankFromWhite;
      const centerDistance = Math.abs(file - 3.5) + Math.abs(rank - 3.5);

      if (piece.type === "p") {
        score += sign * (relativeRank * 5 - Math.floor(centerDistance * 2));
        pawnFiles[piece.color][file] += 1;
        pawns.push({ color: piece.color, rank, file, relativeRank });
      }
      if (piece.type === "n" || piece.type === "b") score += sign * Math.round(18 - centerDistance * 4);
      if (piece.type === "r" && relativeRank === 6) score += sign * 18;
      if (piece.type === "b") {
        if (piece.color === "w") whiteBishops += 1;
        else blackBishops += 1;
      }
      if (piece.type === "k") kings[piece.color] = { rank, file, relativeRank };
      if (fullmoveNumber <= 12 && (piece.type === "n" || piece.type === "b")) {
        const onStartingRank = relativeRank === 0;
        const onStartingFile = piece.type === "n" ? file === 1 || file === 6 : file === 2 || file === 5;
        if (onStartingRank && onStartingFile) {
          if (piece.color === "w") whiteUndevelopedMinors += 1;
          else blackUndevelopedMinors += 1;
        }
      }
    }
  }

  if (whiteBishops >= 2) score += 35;
  if (blackBishops >= 2) score -= 35;
  if (fullmoveNumber <= 12) score += (blackUndevelopedMinors - whiteUndevelopedMinors) * 8;

  for (const color of ["w", "b"] as const) {
    const sign = color === "w" ? 1 : -1;
    for (let file = 0; file < 8; file += 1) {
      const count = pawnFiles[color][file];
      if (count > 1) score -= sign * (count - 1) * 18;
      if (count > 0 && (pawnFiles[color][file - 1] ?? 0) === 0 && (pawnFiles[color][file + 1] ?? 0) === 0) {
        score -= sign * count * 12;
      }
    }

    const king = kings[color];
    if (king && fullmoveNumber <= 20) {
      const isCastled = king.relativeRank === 0 && (king.file === 2 || king.file === 6);
      const isOnStartingSquare = king.relativeRank === 0 && king.file === 4;
      const availableCastlingRights = color === "w"
        ? Number(castlingRights.includes("K")) + Number(castlingRights.includes("Q"))
        : Number(castlingRights.includes("k")) + Number(castlingRights.includes("q"));

      if (isCastled) score += sign * CASTLED_KING_BONUS;
      else if (!isOnStartingSquare) score -= sign * EARLY_KING_MOVE_PENALTY;
      else if (availableCastlingRights > 0) {
        score += sign * availableCastlingRights * CASTLING_RIGHT_BONUS;
      } else {
        score -= sign * LOST_CASTLING_PENALTY;
      }

      const shieldRank = king.rank + (color === "w" ? -1 : 1);
      for (let file = king.file - 1; file <= king.file + 1; file += 1) {
        const shield = board[shieldRank]?.[file];
        if (shield?.type === "p" && shield.color === color) score += sign * 6;
      }
    }
  }

  for (const pawn of pawns) {
    const opponent = pawn.color === "w" ? "b" : "w";
    const blockedByOpponentPawn = pawns.some((other) => (
      other.color === opponent
      && Math.abs(other.file - pawn.file) <= 1
      && (pawn.color === "w" ? other.rank < pawn.rank : other.rank > pawn.rank)
    ));
    if (!blockedByOpponentPawn) score += (pawn.color === "w" ? 1 : -1) * pawn.relativeRank * 4;
  }
  return score;
}

function evaluate(game: Chess, wasm: WasmEngineExports, ply = 0): number {
  if (game.isCheckmate()) return -MATE_SCORE + ply;
  if (game.isDraw()) return 0;

  const whiteScore = materialScore(game, wasm) + positionalScore(game);
  return game.turn() === "w" ? whiteScore : -whiteScore;
}

function allocateSearchTime(remainingTimeMs?: number, incrementMs = 0): number {
  if (remainingTimeMs === undefined) return MAX_SEARCH_MS;
  const desired = remainingTimeMs / 100 + incrementMs * 0.5;
  const allocation = Math.min(MAX_SEARCH_ALLOCATION_MS, Math.max(MIN_SEARCH_MS, desired));
  return Math.max(100, Math.min(allocation, remainingTimeMs - 500));
}

function checkTime(ctx: SearchContext): void {
  ctx.nodes += 1;
  if (ctx.nodeLimit !== undefined && ctx.nodes >= ctx.nodeLimit) throw new SearchTimeout();
  if (
    ctx.completedDepth >= ctx.minimumDepth
    && (ctx.nodes === 1 || ctx.nodes % TIME_CHECK_INTERVAL === 0)
    && performance.now() >= ctx.deadline
  ) {
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
  if (repetitionCount(game, ctx) >= 3) return 0;
  if (game.isGameOver()) return evaluate(game, wasm, ply);

  const inCheck = game.isCheck();
  let best = alpha;
  if (!inCheck) {
    const standPat = evaluate(game, wasm, ply);
    if (standPat >= beta) return standPat;
    best = Math.max(best, standPat);
    if (depth >= MAX_QUIESCENCE_DEPTH) return best;
  }

  const moves = inCheck
    ? orderedMoves(game, ctx, ply)
    : orderedMoves(game, ctx, ply, undefined, true);
  for (const move of moves) {
    playSearchMove(game, move, ctx);
    try {
      const score = depth >= MAX_QUIESCENCE_DEPTH
        ? -evaluate(game, wasm, ply + 1)
        : -quiescence(game, -beta, -best, ply + 1, depth + 1, wasm, ctx);
      if (score >= beta) return score;
      best = Math.max(best, score);
    } finally {
      undoSearchMove(game, ctx);
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
  if (repetitionCount(game, ctx) >= 3) return 0;
  if (game.isGameOver()) return evaluate(game, wasm, ply);
  if (depth <= 0) return quiescence(game, alpha, beta, ply, 0, wasm, ctx);

  const alphaOriginal = alpha;
  const betaOriginal = beta;
  const position = transpositionKey(game);
  const canUseTransposition = repetitionCount(game, ctx) <= 1;
  const entry = canUseTransposition ? ctx.tt.get(position) : undefined;
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
    const quietHistoryKey = !move.captured && !move.promotion
      ? historyKey(game, move)
      : undefined;
    playSearchMove(game, move, ctx);
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
        if (quietHistoryKey) {
          rememberKiller(ctx, ply, move);
          ctx.history.set(
            quietHistoryKey,
            (ctx.history.get(quietHistoryKey) ?? 0) + depth * depth,
          );
        }
        break;
      }
    } finally {
      undoSearchMove(game, ctx);
    }
  }

  const flag: Bound = bestScore <= alphaOriginal ? "upper" : bestScore >= betaOriginal ? "lower" : "exact";
  if (bestMove && canUseTransposition && Math.abs(bestScore) < MATE_BOUND) {
    ctx.tt.set(position, { depth, score: bestScore, flag, bestMove: moveKey(bestMove) });
  }
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
    playSearchMove(game, move, ctx);
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
      undoSearchMove(game, ctx);
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
  const current = getGameOutcome(game);
  if (current.result !== "*") return current;
  if ((options.positionCounts?.[positionKey(game)] ?? 0) >= 3) {
    return { result: "1/2-1/2", termination: "threefold repetition" };
  }

  const bookMove = getOpeningBookMove(game);
  if (bookMove) {
    const played = game.move({
      from: bookMove.from as Square,
      to: bookMove.to as Square,
      promotion: bookMove.promotion,
    });
    const end = getGameOutcome(game);
    return {
      updated_fen: game.fen(),
      result: end.result,
      termination: end.termination,
      captured: played.captured,
      move: { from: played.from, to: played.to, san: played.san, promotion: played.promotion },
    };
  }

  const wasm = await loadWasmEngine();
  const startedAt = performance.now();
  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const ctx: SearchContext = {
    startedAt,
    deadline: startedAt + Math.max(
      10,
      options.timeLimitMs ?? allocateSearchTime(options.remainingTimeMs, options.incrementMs),
    ),
    minimumDepth: Math.min(MINIMUM_COMPLETED_DEPTH, maxDepth),
    nodeLimit: options.nodeLimit,
    nodes: 0,
    completedDepth: 0,
    timedOut: false,
    tt: new Map(),
    killers: new Map(),
    history: new Map(),
    repetitionCounts: new Map(Object.entries(options.positionCounts ?? { [positionKey(game)]: 1 })),
  };

  const rootMoves = orderedMoves(game, ctx, 0);
  let bestMove = rootMoves[0];
  let bestScore = evaluate(game, wasm);
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
  const end = getGameOutcome(game);
  return {
    updated_fen: game.fen(),
    result: end.result,
    termination: end.termination,
    captured: played.captured,
    move: { from: played.from, to: played.to, san: played.san, promotion: played.promotion },
    search: diagnostics(ctx, bestScore),
  };
}

export async function evaluateQuiescenceForTesting(
  fen: string,
  alpha: number,
  beta: number,
): Promise<{ score: number; nodes: number }> {
  const game = new Chess(fen);
  const wasm = await loadWasmEngine();
  const startedAt = performance.now();
  const ctx: SearchContext = {
    startedAt,
    deadline: startedAt + 30_000,
    minimumDepth: 0,
    nodes: 0,
    completedDepth: 0,
    timedOut: false,
    tt: new Map(),
    killers: new Map(),
    history: new Map(),
    repetitionCounts: new Map([[positionKey(game), 1]]),
  };
  const score = quiescence(game, alpha, beta, 0, 0, wasm, ctx);
  return { score, nodes: ctx.nodes };
}

export function searchTimeForTesting(remainingTimeMs: number, incrementMs: number): number {
  return allocateSearchTime(remainingTimeMs, incrementMs);
}

export async function evaluatePositionForTesting(fen: string, ply = 0): Promise<number> {
  const game = new Chess(fen);
  const wasm = await loadWasmEngine();
  return evaluate(game, wasm, ply);
}

export function transpositionKeyForTesting(fen: string): string {
  return transpositionKey(new Chess(fen));
}
