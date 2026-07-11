import { Chess } from "chess.js";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "gambitron.localGames.v1";

export interface LocalMoveInput {
  color: "w" | "b";
  from?: string;
  to?: string;
  san?: string;
}

export interface LocalReplayMove {
  ply: number;
  fen: string;
  san: string;
  from_square?: string;
  to_square?: string;
  captured?: string;
  color?: "w" | "b";
}

export interface LocalGameRecord {
  id: string;
  created_at: string;
  time_control_ms: number;
  result: string | null;
  termination: string | null;
  player_color: "white" | "black";
  moves: LocalReplayMove[];
}

function readAll(): LocalGameRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalGameRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(games: LocalGameRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games.slice(0, 50)));
}

export function listLocalGames(): LocalGameRecord[] {
  return readAll();
}

export function getLocalGame(id: string): LocalGameRecord | null {
  return readAll().find((game) => game.id === id) ?? null;
}

export async function listSavedGames(): Promise<LocalGameRecord[]> {
  if (!supabase) return listLocalGames();

  const { data, error } = await supabase
    .from("games")
    .select("id, created_at, time_control_ms, result, termination, player_color")
    .not("result", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return listLocalGames();

  return data.map((game) => ({
    id: game.id,
    created_at: game.created_at,
    time_control_ms: game.time_control_ms,
    result: game.result,
    termination: game.termination,
    player_color: game.player_color === "black" ? "black" : "white",
    moves: [],
  }));
}

export async function getSavedGame(id: string): Promise<LocalGameRecord | null> {
  if (!supabase) return getLocalGame(id);

  const [{ data: game, error: gameError }, { data: moves, error: movesError }] = await Promise.all([
    supabase
      .from("games")
      .select("id, created_at, time_control_ms, result, termination, player_color")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("game_moves")
      .select("ply, fen, san, from_square, to_square, captured, color")
      .eq("game_id", id)
      .order("ply", { ascending: true }),
  ]);

  if (gameError || movesError || !game || !moves) return getLocalGame(id);

  return {
    id: game.id,
    created_at: game.created_at,
    time_control_ms: game.time_control_ms,
    result: game.result,
    termination: game.termination,
    player_color: game.player_color === "black" ? "black" : "white",
    moves: moves.map((move) => ({
      ply: move.ply,
      fen: move.fen,
      san: move.san,
      from_square: move.from_square ?? undefined,
      to_square: move.to_square ?? undefined,
      captured: move.captured ?? undefined,
      color: move.color === "b" ? "b" : "w",
    })),
  };
}

export function buildReplayMoves(history: LocalMoveInput[]): LocalReplayMove[] {
  const chess = new Chess();
  const moves: LocalReplayMove[] = [];

  history.forEach((entry) => {
    const played = entry.san
      ? chess.move(entry.san)
      : entry.from && entry.to
      ? chess.move({ from: entry.from, to: entry.to, promotion: "q" })
      : null;

    if (!played) return;
    moves.push({
      ply: moves.length + 1,
      fen: chess.fen(),
      san: played.san,
      from_square: played.from,
      to_square: played.to,
      captured: played.captured,
      color: entry.color,
    });
  });

  return moves;
}

export async function saveLocalGame(record: LocalGameRecord) {
  const games = readAll().filter((game) => game.id !== record.id);
  writeAll([record, ...games]);

  if (!supabase) return;

  const { error: gameError } = await supabase.from("games").insert({
    id: record.id,
    created_at: record.created_at,
    ended_at: new Date().toISOString(),
    time_control_ms: record.time_control_ms,
    result: record.result,
    termination: record.termination,
    player_color: record.player_color,
    metadata: { source: "frontend-wasm", move_count: record.moves.length },
  });

  if (gameError) return;

  if (record.moves.length === 0) return;

  await supabase.from("game_moves").insert(
    record.moves.map((move) => ({
      game_id: record.id,
      ply: move.ply,
      fen: move.fen,
      san: move.san,
      from_square: move.from_square ?? null,
      to_square: move.to_square ?? null,
      captured: move.captured ?? null,
      color: move.color ?? null,
    }))
  );
}
