import { useState } from "react";
import { useHistory, Link } from "react-router-dom";
import { Shuffle, X } from "lucide-react";

const PLAY_MODES = [
  { label: "Bullet", sublabel: "1 min", minutes: 1 },
  { label: "Blitz", sublabel: "3 min", minutes: 3 },
  { label: "Blitz", sublabel: "5 min", minutes: 5 },
  { label: "Rapid", sublabel: "10 min", minutes: 10 },
  { label: "Rapid", sublabel: "15 min", minutes: 15 },
  { label: "Classical", sublabel: "30 min", minutes: 30 },
];

export default function Landing() {
  const [selectedMode, setSelectedMode] = useState<{ label: string; sublabel: string; minutes: number } | null>(null);
  const history = useHistory();

  const handleColorPick = (minutes: number, color: "white" | "black") => {
    history.push(`/play/new?minutes=${minutes}&color=${color}`);
  };

  const handleRandomPick = (minutes: number) => {
    const color = Math.random() < 0.5 ? "white" : "black";
    history.push(`/play/new?minutes=${minutes}&color=${color}`);
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.7_0.15_195/0.12),transparent_50%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,oklch(0.5_0.1_195/0.08),transparent_50%)]" />
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(oklch(1_0_0/0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(1_0_0/0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <section className="relative mx-auto max-w-xl px-4 pt-8 pb-12 sm:pt-12 sm:pb-16 min-h-full">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-4 rounded-2xl bg-primary/10 border border-primary/20">
            <span className="text-4xl sm:text-5xl" aria-hidden={true}>♔</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Gambitron
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-sm mx-auto">
            Chess AI · minimax & αβ pruning
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PLAY_MODES.map((mode) => (
            <button
              key={mode.minutes}
              type="button"
              onClick={() => setSelectedMode(mode)}
              className="rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 py-6 px-4 text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            >
              <div className="font-semibold text-foreground">{mode.label}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">{mode.sublabel}</div>
            </button>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border/50">
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <Link to="/history" className="hover:text-foreground transition-colors">
              History
            </Link>
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
          </div>
        </div>
      </section>

      {selectedMode !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="color-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedMode(null)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <p id="color-modal-title" className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {selectedMode.label} · {selectedMode.sublabel}
              </p>
              <button
                type="button"
                onClick={() => setSelectedMode(null)}
                className="p-1.5 -mr-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-6">Play as</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleColorPick(selectedMode.minutes, "white")}
                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-border bg-white text-[#333] hover:border-primary/50 hover:bg-white/95 transition-all font-medium shadow-sm"
              >
                <img src="/pieces/k-white.svg" alt="" className="w-6 h-6" />
                White
              </button>
              <button
                type="button"
                onClick={() => handleColorPick(selectedMode.minutes, "black")}
                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-border bg-[#1a1a1a] text-white hover:border-primary/50 hover:bg-[#2a2a2a] transition-all font-medium shadow-sm"
              >
                <img src="/pieces/k-black.svg" alt="" className="w-6 h-6" />
                Black
              </button>
              <button
                type="button"
                onClick={() => handleRandomPick(selectedMode.minutes)}
                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30 transition-all font-medium"
              >
                <Shuffle className="w-5 h-5" />
                Random
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
