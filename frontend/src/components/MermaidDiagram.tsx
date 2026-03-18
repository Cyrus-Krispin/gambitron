import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!chart.trim() || !containerRef.current) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        primaryColor: "oklch(0.55 0.15 250 / 0.15)",
        primaryTextColor: "oklch(0.9 0 0)",
        primaryBorderColor: "oklch(0.5 0 0 / 0.3)",
        lineColor: "oklch(0.6 0 0 / 0.5)",
        secondaryColor: "oklch(0.3 0 0 / 0.2)",
        tertiaryColor: "oklch(0.25 0 0 / 0.15)",
      },
    });

    setError(null);

    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        setError(err.message ?? "Failed to render diagram");
      });
  }, [chart]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-4 [&_svg]:max-w-full"
    />
  );
}
