import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const enginePath = path.join(frontendRoot, "src/lib/wasmEngine.ts");
const baselineRef = process.env.ENGINE_BASELINE ?? "HEAD";
const timeLimitMs = Number(process.env.ENGINE_TIME_LIMIT_MS ?? 120);

const tacticalPositions = [
  { name: "mate in one", fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", sans: ["Qf8#", "Qe8#"] },
  { name: "promotion mate", fen: "7k/P7/7K/8/8/8/8/8 w - - 0 1", sans: ["a8=Q#"] },
  { name: "back-rank tactic", fen: "3r2k1/pp3ppp/2p1q3/8/4P3/2Q2P2/PP3P1P/3R2K1 w - - 0 25", sans: ["Rxd8+"] },
  { name: "en passant", fen: "8/8/8/3pP3/8/8/8/4K2k w - d6 0 1", sans: ["exd6"] },
];

const openings = [
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 4",
];

async function loadEngine(source) {
  const result = await build({
    stdin: {
      contents: source,
      sourcefile: "wasmEngine.ts",
      resolveDir: path.dirname(enginePath),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
  });
  const encoded = Buffer.from(result.outputFiles[0].text).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function baselineSource() {
  const source = execFileSync(
    "git",
    ["show", `${baselineRef}:frontend/src/lib/wasmEngine.ts`],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  return source.replace("const MAX_SEARCH_MS = 450;", `const MAX_SEARCH_MS = ${timeLimitMs};`);
}

async function choose(engine, fen) {
  return engine.calculateAIMove(fen, { maxDepth: 7, timeLimitMs });
}

async function playGame(white, black, fen) {
  const board = new Chess(fen);
  for (let ply = 0; ply < 48; ply += 1) {
    if (board.isGameOver()) break;
    const engine = board.turn() === "w" ? white : black;
    const result = await choose(engine, board.fen());
    if (!result.move?.from || !result.move.to) return 0.5;
    board.move({ from: result.move.from, to: result.move.to, promotion: result.move.promotion });
  }
  if (board.isCheckmate()) return board.turn() === "w" ? 0 : 1;
  return 0.5;
}

const candidate = await loadEngine(await readFile(enginePath, "utf8"));
const baseline = await loadEngine(baselineSource());

let candidateSolved = 0;
let baselineSolved = 0;
for (const position of tacticalPositions) {
  const oldResult = await choose(baseline, position.fen);
  const newResult = await choose(candidate, position.fen);
  baselineSolved += Number(position.sans.includes(oldResult.move?.san));
  candidateSolved += Number(position.sans.includes(newResult.move?.san));
  console.log(`${position.name}: baseline=${oldResult.move?.san} candidate=${newResult.move?.san}`);
}

let candidateScore = 0;
for (const opening of openings) {
  candidateScore += await playGame(candidate, baseline, opening);
  candidateScore += 1 - await playGame(baseline, candidate, opening);
}

console.log(`tactics: candidate ${candidateSolved}/${tacticalPositions.length}, baseline ${baselineSolved}/${tacticalPositions.length}`);
console.log(`paired self-play: candidate ${candidateScore}/${openings.length * 2}`);

if (candidateSolved < baselineSolved) {
  throw new Error("Candidate regressed on the tactical suite.");
}
if (candidateScore < openings.length) {
  throw new Error("Candidate lost the paired self-play match.");
}
