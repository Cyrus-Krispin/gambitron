import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground">About</h1>
      <p className="mt-4 text-muted-foreground leading-relaxed">
        Gambitron is a chess AI built as a personal project to explore game theory algorithms
        and full-stack development.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
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
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">How it was built</h2>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          <li><strong className="text-foreground">Frontend:</strong> React, TypeScript, Vite, Tailwind, shadcn/ui</li>
          <li><strong className="text-foreground">Chess logic:</strong> chess.js (client), python-chess (backend)</li>
          <li><strong className="text-foreground">AI:</strong> Minimax with alpha-beta pruning, piece-square tables</li>
          <li><strong className="text-foreground">Backend:</strong> FastAPI (local), AWS Lambda (production)</li>
          <li><strong className="text-foreground">Deployment:</strong> Vercel (frontend), API Gateway (backend)</li>
        </ul>
      </section>

      <div className="mt-12">
        <Button asChild variant="outline">
          <Link to="/">Play Gambitron</Link>
        </Button>
      </div>
    </div>
  );
}
