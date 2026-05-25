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
 * Plays a triumphant ascending arpeggio — you checkmated Gambitron.
 */
export function playWinSound(): void {
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

/**
 * Plays a somber descending minor arpeggio — Gambitron checkmated you.
 */
export function playLossSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.15 },
      { freq: 440.00, start: 0.12, dur: 0.15 },
      { freq: 349.23, start: 0.24, dur: 0.18 },
      { freq: 261.63, start: 0.36, dur: 0.40 },
    ];

    for (const { freq, start, dur } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.13, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    }

    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.connect(lowGain);
    lowGain.connect(ctx.destination);
    low.type = "sine";
    low.frequency.setValueAtTime(82.41, now + 0.48);
    lowGain.gain.setValueAtTime(0, now + 0.48);
    lowGain.gain.linearRampToValueAtTime(0.16, now + 0.53);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    low.start(now + 0.48);
    low.stop(now + 1.0);
  } catch {
    // Ignore audio errors
  }
}
