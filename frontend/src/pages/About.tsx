import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MermaidDiagram } from "@/components/MermaidDiagram";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}

const DIAGRAM_1_0 = `flowchart LR
    subgraph Client["React Frontend (Vercel)"]
        FE["localStorage, Client timers, No history"]
    end
    subgraph AWS["AWS"]
        APIGW["API Gateway REST"]
        Lambda["AWS Lambda 30s timeout"]
    end
    Client -->|"POST ?value=FEN"| APIGW
    APIGW --> Lambda
    Lambda -->|"{updated_fen, result}"| Client`;

const DIAGRAM_1_1 = `flowchart TB
    subgraph Client["React Frontend (Vercel)"]
        C["Game history, Replay, Reconnect, White or Black"]
    end
    subgraph Backend["EC2 + FastAPI"]
        B["WebSocket /ws, REST /games, Backend timers, No timeout"]
    end
    subgraph DB["PostgreSQL"]
        D["games + pgn"]
    end
    Client <-->|"WebSocket"| Backend
    Client -->|"GET /games"| Backend
    Backend --> DB`;

const DIAGRAM_WS_FLOW = `sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: start_game
    S->>C: game_started
    C->>S: player_move
    S->>S: append_move, AI
    S->>C: ai_move
    loop 100ms
        S->>C: time_update
    end`;

export default function About() {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14 overflow-x-hidden">
        <h1 className="text-2xl font-bold text-foreground">About</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chess AI · minimax & αβ pruning · WebSocket · game history
        </p>

        {/* 1.0 Architecture */}
        <Section title="1.0 Architecture (Legacy)">
          <MermaidDiagram chart={DIAGRAM_1_0} />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>• REST POST per move</span>
            <span>• 30s timeout</span>
            <span>• No game history</span>
            <span>• Client-owned timers</span>
          </div>
        </Section>

        {/* 1.1 Architecture */}
        <Section title="1.1 Architecture (Current)">
          <MermaidDiagram chart={DIAGRAM_1_1} />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>• WebSocket bidirectional</span>
            <span>• Game history + replay</span>
            <span>• Server-owned timers</span>
            <span>• Play as White or Black</span>
          </div>
        </Section>

        {/* Migration Table */}
        <Section title="1.0 → 1.1 Migration">
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-foreground">Aspect</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">1.0</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">1.1</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/40">
                  <td className="py-2 px-3">Transport</td>
                  <td className="py-2 px-3">REST POST per move</td>
                  <td className="py-2 px-3">WebSocket</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-2 px-3">Backend</td>
                  <td className="py-2 px-3">AWS Lambda</td>
                  <td className="py-2 px-3">EC2 + FastAPI</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-2 px-3">Timeout</td>
                  <td className="py-2 px-3">30s</td>
                  <td className="py-2 px-3">None</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-2 px-3">History</td>
                  <td className="py-2 px-3">None</td>
                  <td className="py-2 px-3">GET /games, replay</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-2 px-3">Timers</td>
                  <td className="py-2 px-3">Client</td>
                  <td className="py-2 px-3">Server (100ms tick)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Color</td>
                  <td className="py-2 px-3">White only</td>
                  <td className="py-2 px-3">White or Black</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* WebSocket Flow */}
        <Section title="WebSocket Flow">
          <MermaidDiagram chart={DIAGRAM_WS_FLOW} />
        </Section>

        {/* Tech Stack */}
        <Section title="Tech Stack">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="font-medium text-foreground">Frontend</div>
              <div className="text-xs text-muted-foreground mt-0.5">React, TypeScript, Vite, Tailwind, shadcn/ui</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="font-medium text-foreground">Chess</div>
              <div className="text-xs text-muted-foreground mt-0.5">chess.js (client), python-chess (backend)</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="font-medium text-foreground">AI</div>
              <div className="text-xs text-muted-foreground mt-0.5">Minimax, αβ pruning, piece-square tables</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="font-medium text-foreground">Backend</div>
              <div className="text-xs text-muted-foreground mt-0.5">FastAPI, WebSocket, uvicorn</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="font-medium text-foreground">DB</div>
              <div className="text-xs text-muted-foreground mt-0.5">PostgreSQL (games + PGN)</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="font-medium text-foreground">Deploy</div>
              <div className="text-xs text-muted-foreground mt-0.5">Vercel (frontend), EC2 (backend)</div>
            </div>
          </div>
        </Section>

        {/* Profile */}
        <Section title="Profile">
          <div className="flex gap-3">
            <a href="https://github.com/Cyrus-Krispin" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
              <img src="/github.svg" alt="" className="w-8 h-8 opacity-70" />
            </a>
            <a href="https://www.linkedin.com/in/cyruskrispin/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
              <img src="/linkedin.svg" alt="" className="w-8 h-8 opacity-70" />
            </a>
            <a href="https://leetcode.com/u/cyrus-krispin/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LeetCode">
              <img src="/leetcode.svg" alt="" className="w-8 h-8 opacity-70" />
            </a>
          </div>
        </Section>

        <div className="mt-10">
          <Button asChild variant="outline">
            <Link to="/">Play Gambitron</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
