import { useState } from "react";
import { useHistory, Link } from "react-router-dom";
import { Shuffle } from "lucide-react";

const PLAY_MODES = [
  { label: "Bullet", sublabel: "1 min", minutes: 1 },
  { label: "Blitz", sublabel: "3 min", minutes: 3 },
  { label: "Blitz", sublabel: "5 min", minutes: 5 },
  { label: "Rapid", sublabel: "10 min", minutes: 10 },
  { label: "Rapid", sublabel: "15 min", minutes: 15 },
  { label: "Classical", sublabel: "30 min", minutes: 30 },
];

export default function Landing() {
  const [flippedMinutes, setFlippedMinutes] = useState<number | null>(null);
  const history = useHistory();

  const handleColorPick = (minutes: number, color: "white" | "black") => {
    history.push(`/play/new?minutes=${minutes}&color=${color}`);
  };

  const handleRandomPick = (minutes: number) => {
    const color = Math.random() < 0.5 ? "white" : "black";
    history.push(`/play/new?minutes=${minutes}&color=${color}`);
  };

  return (
    <div className="h-full relative overflow-hidden">
      {/* Background gradient - teal theme */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.7_0.15_195/0.12),transparent_50%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,oklch(0.5_0.1_195/0.08),transparent_50%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_40%_30%_at_20%_80%,oklch(0.6_0.12_180/0.06),transparent_50%)]" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(oklch(1_0_0/0.5) 1px, transparent 1px),
            linear-gradient(90deg, oklch(1_0_0/0.5) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <section className="mx-auto max-w-2xl px-4 py-6 sm:py-8 h-full flex flex-col justify-center">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-block mb-2 text-4xl opacity-90">♔</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Gambitron
          </h1>
          <p className="mt-2 text-base text-muted-foreground max-w-md mx-auto">
            Chess AI powered by minimax and alpha-beta pruning. Choose your time control.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PLAY_MODES.map((mode) => {
            const isFlipped = flippedMinutes === mode.minutes;
            return (
              <div
                key={mode.minutes}
                className="relative h-28 sm:h-32 [perspective:1000px]"
              >
                <div
                  className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                    isFlipped ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  {/* Front - time control */}
                  <div
                    className="absolute inset-0 cursor-pointer rounded-lg border border-border/80 bg-card/80 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 overflow-hidden [backface-visibility:hidden]"
                    onClick={() => setFlippedMinutes(isFlipped ? null : mode.minutes)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative p-5 sm:p-6 h-full flex flex-col justify-center items-center text-center">
                      <div className="font-semibold text-foreground">{mode.label}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{mode.sublabel}</div>
                    </div>
                  </div>

                  {/* Back - color selection */}
                  <div
                    className="absolute inset-0 rounded-lg border border-border/80 bg-card/90 backdrop-blur-sm overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  >
                    <div className="p-3 h-full flex flex-col justify-between items-center min-h-0 text-center">
                      <div className="font-semibold text-foreground text-sm">
                        {mode.label} {mode.sublabel}
                      </div>
                      <div className="space-y-1 flex flex-col items-center">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Play as</div>
                        <div className="flex gap-1.5 items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleColorPick(mode.minutes, "white");
                            }}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border border-border bg-white text-[#333] hover:bg-white/90 transition-colors text-xs font-medium"
                          >
                            <img src="/pieces/k-white.svg" alt="" className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">White</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleColorPick(mode.minutes, "black");
                            }}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border border-border bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] transition-colors text-xs font-medium"
                          >
                            <img src="/pieces/k-black.svg" alt="" className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">Black</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRandomPick(mode.minutes);
                            }}
                            className="flex items-center justify-center p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                            title="Random"
                          >
                            <Shuffle className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedMinutes(null);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <span className="text-border">·</span>
            <span>Minimax + αβ pruning</span>
            <span className="text-border">·</span>
            <span>6 time controls</span>
          </div>
        </div>
      </section>
    </div>
  );
}
