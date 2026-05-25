let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioContext = new Ctx();
  }
  return audioContext;
}

/**
 * Plays a subtle "piece move" sound - a short wooden click.
 */
export function playMoveSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Ignore audio errors (e.g. autoplay policy)
  }
}

/**
 * Plays a triumphant "checkmate" sound —
 * an ascending major arpeggio with a bright finish (you won).
 */
export function playCheckmateSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.14 },
      { freq: 659.25, start: 0.10, dur: 0.14 },
      { freq: 783.99, start: 0.20, dur: 0.14 },
      { freq: 1046.50, start: 0.30, dur: 0.22 },
    ];

    for (const { freq, start, dur } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    }

    const bright = ctx.createOscillator();
    const brightGain = ctx.createGain();
    bright.connect(brightGain);
    brightGain.connect(ctx.destination);
    bright.type = "sine";
    bright.frequency.setValueAtTime(1318.51, now + 0.45);
    brightGain.gain.setValueAtTime(0, now + 0.45);
    brightGain.gain.linearRampToValueAtTime(0.12, now + 0.50);
    brightGain.gain.exponentialRampToValueAtTime(0.001, now + 0.80);
    bright.start(now + 0.45);
    bright.stop(now + 0.80);
  } catch {
    // Ignore audio errors
  }
}
