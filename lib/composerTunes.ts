// Programmatic musical motifs per composer using Web Audio API
// Returns a stop() function to cancel playback

type StopFn = () => void;

interface Note {
  freq: number;
  duration: number; // seconds
  delay: number;    // seconds from start
}

const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23,
      G4 = 392.00, A4 = 440.00, B4 = 493.88,
      C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99,
      Bb4 = 466.16, Eb4 = 311.13, Ab4 = 415.30, Fs4 = 369.99,
      Cs5 = 554.37, Gs4 = 415.30;

const MOTIFS: Record<string, Note[]> = {
  Bach: [
    { freq: C4, duration: 0.15, delay: 0 },
    { freq: E4, duration: 0.15, delay: 0.18 },
    { freq: G4, duration: 0.15, delay: 0.36 },
    { freq: C5, duration: 0.15, delay: 0.54 },
    { freq: B4, duration: 0.15, delay: 0.72 },
    { freq: G4, duration: 0.15, delay: 0.90 },
    { freq: A4, duration: 0.3,  delay: 1.08 },
  ],
  Beethoven: [
    { freq: G4, duration: 0.12, delay: 0 },
    { freq: G4, duration: 0.12, delay: 0.14 },
    { freq: G4, duration: 0.12, delay: 0.28 },
    { freq: Eb4, duration: 0.6, delay: 0.42 },
    { freq: F4, duration: 0.12, delay: 1.1 },
    { freq: F4, duration: 0.12, delay: 1.24 },
    { freq: F4, duration: 0.12, delay: 1.38 },
    { freq: D4, duration: 0.6,  delay: 1.52 },
  ],
  Mozart: [
    { freq: C5, duration: 0.12, delay: 0 },
    { freq: B4, duration: 0.12, delay: 0.14 },
    { freq: A4, duration: 0.12, delay: 0.28 },
    { freq: G4, duration: 0.12, delay: 0.42 },
    { freq: A4, duration: 0.12, delay: 0.56 },
    { freq: B4, duration: 0.12, delay: 0.70 },
    { freq: C5, duration: 0.4,  delay: 0.84 },
  ],
  Chopin: [
    { freq: E4,  duration: 0.3,  delay: 0 },
    { freq: Gs4, duration: 0.15, delay: 0.35 },
    { freq: B4,  duration: 0.15, delay: 0.55 },
    { freq: Cs5, duration: 0.4,  delay: 0.75 },
    { freq: B4,  duration: 0.15, delay: 1.2 },
    { freq: Gs4, duration: 0.15, delay: 1.4 },
    { freq: E4,  duration: 0.5,  delay: 1.6 },
  ],
  Debussy: [
    { freq: D4,  duration: 0.4,  delay: 0 },
    { freq: Fs4, duration: 0.4,  delay: 0.45 },
    { freq: A4,  duration: 0.4,  delay: 0.9 },
    { freq: C5,  duration: 0.4,  delay: 1.35 },
    { freq: E5,  duration: 0.8,  delay: 1.8 },
  ],
  Brahms: [
    { freq: C4, duration: 0.2,  delay: 0 },
    { freq: E4, duration: 0.2,  delay: 0.25 },
    { freq: G4, duration: 0.2,  delay: 0.5 },
    { freq: E4, duration: 0.2,  delay: 0.75 },
    { freq: F4, duration: 0.2,  delay: 1.0 },
    { freq: A4, duration: 0.2,  delay: 1.25 },
    { freq: G4, duration: 0.5,  delay: 1.5 },
  ],
  Tchaikovsky: [
    { freq: B4,  duration: 0.3,  delay: 0 },
    { freq: A4,  duration: 0.15, delay: 0.35 },
    { freq: G4,  duration: 0.15, delay: 0.55 },
    { freq: Fs4, duration: 0.3,  delay: 0.75 },
    { freq: G4,  duration: 0.15, delay: 1.1 },
    { freq: A4,  duration: 0.15, delay: 1.3 },
    { freq: B4,  duration: 0.5,  delay: 1.5 },
  ],
  Schubert: [
    { freq: G4,  duration: 0.2,  delay: 0 },
    { freq: Bb4, duration: 0.2,  delay: 0.25 },
    { freq: D5,  duration: 0.2,  delay: 0.5 },
    { freq: Bb4, duration: 0.2,  delay: 0.75 },
    { freq: G4,  duration: 0.2,  delay: 1.0 },
    { freq: F4,  duration: 0.5,  delay: 1.25 },
  ],
  Liszt: [
    { freq: E4,  duration: 0.1,  delay: 0 },
    { freq: G4,  duration: 0.1,  delay: 0.12 },
    { freq: B4,  duration: 0.1,  delay: 0.24 },
    { freq: E5,  duration: 0.3,  delay: 0.36 },
    { freq: D5,  duration: 0.1,  delay: 0.7 },
    { freq: B4,  duration: 0.1,  delay: 0.82 },
    { freq: Cs5, duration: 0.5,  delay: 0.94 },
  ],
  Handel: [
    { freq: G4,  duration: 0.2,  delay: 0 },
    { freq: A4,  duration: 0.2,  delay: 0.25 },
    { freq: B4,  duration: 0.2,  delay: 0.5 },
    { freq: C5,  duration: 0.2,  delay: 0.75 },
    { freq: D5,  duration: 0.2,  delay: 1.0 },
    { freq: E5,  duration: 0.2,  delay: 1.25 },
    { freq: F5,  duration: 0.4,  delay: 1.5 },
  ],
  Vivaldi: [
    { freq: E5,  duration: 0.1,  delay: 0 },
    { freq: D5,  duration: 0.1,  delay: 0.12 },
    { freq: C5,  duration: 0.1,  delay: 0.24 },
    { freq: B4,  duration: 0.1,  delay: 0.36 },
    { freq: C5,  duration: 0.2,  delay: 0.48 },
    { freq: E5,  duration: 0.1,  delay: 0.7 },
    { freq: D5,  duration: 0.1,  delay: 0.82 },
    { freq: C5,  duration: 0.3,  delay: 0.94 },
  ],
};

export function playComposerTune(composerName: string): StopFn {
  if (typeof window === "undefined") return () => {};

  const motif = MOTIFS[composerName];
  if (!motif) return () => {};

  let ctx: AudioContext | null = null;
  const timeouts: ReturnType<typeof setTimeout>[] = [];

  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    motif.forEach(note => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const filter = ctx!.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.value = note.freq;

      filter.type = "lowpass";
      filter.frequency.value = 1800;

      // ADSR
      const attack = 0.02;
      const release = 0.12;
      const startAt = now + note.delay;
      const endAt = startAt + note.duration;

      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.18, startAt + attack);
      gain.gain.setValueAtTime(0.18, endAt - release);
      gain.gain.linearRampToValueAtTime(0, endAt);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx!.destination);

      osc.start(startAt);
      osc.stop(endAt + 0.05);
    });
  } catch {
    // Web Audio not available
  }

  return () => {
    timeouts.forEach(clearTimeout);
    try { ctx?.close(); } catch { /* ignore */ }
  };
}
