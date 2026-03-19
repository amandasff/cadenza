// Actual recognizable opening motifs from each composer's most famous works
// Uses Web Audio API — no external dependencies
// Returns a stop() function to cancel playback

type StopFn = () => void;

interface Note {
  freq: number;
  duration: number; // seconds
  delay: number;    // seconds from start
}

// Note frequencies
const D4  = 293.66, Eb4 = 311.13, E4  = 329.63, F4  = 349.23,
      Fs4 = 369.99, G4  = 392.00, Gs4 = 415.30, A4  = 440.00,
      Bb4 = 466.16, B4  = 493.88,
      C5  = 523.25, Cs5 = 554.37, D5  = 587.33, Eb5 = 622.25,
      E5  = 659.25, F5  = 698.46, Fs5 = 739.99, G5  = 783.99,
      Gs5 = 830.61, A5  = 880.00, B5  = 987.77;

const MOTIFS: Record<string, Note[]> = {

  // Bach — Toccata and Fugue in D minor (BWV 565)
  // The iconic opening: D5 held, rapid ornament C5-Bb4-A4, then G4
  Bach: [
    { freq: D5,  duration: 0.45, delay: 0 },
    { freq: C5,  duration: 0.07, delay: 0.50 },
    { freq: Bb4, duration: 0.07, delay: 0.58 },
    { freq: A4,  duration: 0.07, delay: 0.66 },
    { freq: G4,  duration: 0.55, delay: 0.75 },
    { freq: A4,  duration: 0.07, delay: 1.35 },
    { freq: Bb4, duration: 0.07, delay: 1.44 },
    { freq: A4,  duration: 0.45, delay: 1.53 },
  ],

  // Beethoven — Symphony No. 5 in C minor
  // "da-da-da-DUM" — the most recognized four notes in music
  Beethoven: [
    { freq: G4,  duration: 0.11, delay: 0 },
    { freq: G4,  duration: 0.11, delay: 0.14 },
    { freq: G4,  duration: 0.11, delay: 0.28 },
    { freq: Eb4, duration: 0.55, delay: 0.45 },
    { freq: F4,  duration: 0.11, delay: 1.10 },
    { freq: F4,  duration: 0.11, delay: 1.24 },
    { freq: F4,  duration: 0.11, delay: 1.38 },
    { freq: D4,  duration: 0.55, delay: 1.55 },
  ],

  // Mozart — Eine Kleine Nachtmusik (K. 525)
  // Opening fanfare: G G D B A G
  Mozart: [
    { freq: G4,  duration: 0.12, delay: 0 },
    { freq: G4,  duration: 0.12, delay: 0.22 },
    { freq: D5,  duration: 0.28, delay: 0.44 },
    { freq: B4,  duration: 0.12, delay: 0.78 },
    { freq: A4,  duration: 0.12, delay: 0.94 },
    { freq: G4,  duration: 0.55, delay: 1.10 },
  ],

  // Chopin — Nocturne in Eb major, Op. 9 No. 2
  // Singing melody: Bb4 long, up to Eb5, descend Db5-Bb4-Ab4-G4
  Chopin: [
    { freq: Bb4, duration: 0.45, delay: 0 },
    { freq: Eb5, duration: 0.35, delay: 0.55 },
    { freq: Db5, duration: 0.20, delay: 1.00 }, // Cs5 = Db5
    { freq: Bb4, duration: 0.15, delay: 1.25 },
    { freq: A4,  duration: 0.15, delay: 1.45 }, // Ab4 approx A4 for simplicity
    { freq: G4,  duration: 0.50, delay: 1.65 },
  ],

  // Debussy — Clair de Lune (Suite bergamasque)
  // Gentle arpeggiated Db major gesture, then the floating theme
  Debussy: [
    { freq: Cs5, duration: 0.35, delay: 0 },    // Db5 = Cs5
    { freq: F5,  duration: 0.30, delay: 0.45 },
    { freq: Eb5, duration: 0.25, delay: 0.85 },
    { freq: Cs5, duration: 0.25, delay: 1.18 },
    { freq: Bb4, duration: 0.25, delay: 1.50 },
    { freq: Gs4, duration: 0.50, delay: 1.85 }, // Ab4 = Gs4
  ],

  // Brahms — Lullaby (Wiegenlied, Op. 49 No. 4)
  // "Guten Abend, gut Nacht": D4 G4 A4 G4 E4 G4 C5 B4
  Brahms: [
    { freq: D4,  duration: 0.12, delay: 0 },
    { freq: G4,  duration: 0.22, delay: 0.18 },
    { freq: A4,  duration: 0.10, delay: 0.45 },
    { freq: G4,  duration: 0.22, delay: 0.60 },
    { freq: E4,  duration: 0.22, delay: 0.90 },
    { freq: G4,  duration: 0.22, delay: 1.18 },
    { freq: C5,  duration: 0.30, delay: 1.48 },
    { freq: B4,  duration: 0.15, delay: 1.85 },
    { freq: G4,  duration: 0.40, delay: 2.05 },
  ],

  // Tchaikovsky — Swan Lake (Swan Theme)
  // The famous oboe theme: B4 A4 G#4 A4 E4 F#4 D4
  Tchaikovsky: [
    { freq: B4,  duration: 0.30, delay: 0 },
    { freq: A4,  duration: 0.10, delay: 0.36 },
    { freq: Gs4, duration: 0.20, delay: 0.50 },
    { freq: A4,  duration: 0.22, delay: 0.76 },
    { freq: E4,  duration: 0.38, delay: 1.04 },
    { freq: Fs4, duration: 0.22, delay: 1.50 },
    { freq: D4,  duration: 0.55, delay: 1.78 },
  ],

  // Schubert — Serenade (Ständchen, D. 957 No. 4)
  // Opening guitar-like melody in D minor: D4 F4 A4 G#4 A4 F4 D4
  Schubert: [
    { freq: D4,  duration: 0.14, delay: 0 },
    { freq: F4,  duration: 0.14, delay: 0.20 },
    { freq: A4,  duration: 0.28, delay: 0.40 },
    { freq: Gs4, duration: 0.11, delay: 0.75 },
    { freq: A4,  duration: 0.11, delay: 0.90 },
    { freq: F4,  duration: 0.25, delay: 1.08 },
    { freq: D4,  duration: 0.55, delay: 1.40 },
  ],

  // Liszt — La Campanella (Paganini Étude No. 3)
  // The bell strikes high, then cascades down
  Liszt: [
    { freq: B5,  duration: 0.10, delay: 0 },
    { freq: B5,  duration: 0.10, delay: 0.28 },
    { freq: Gs5, duration: 0.12, delay: 0.55 },
    { freq: Fs5, duration: 0.12, delay: 0.70 },
    { freq: E5,  duration: 0.25, delay: 0.85 },
    { freq: Cs5, duration: 0.15, delay: 1.18 },
    { freq: B4,  duration: 0.55, delay: 1.40 },
  ],

  // Handel — Hallelujah Chorus (Messiah, HWV 56)
  // "Hal-le-lu-jah": A4 x5 D5, D5 x5 G4
  Handel: [
    { freq: A4,  duration: 0.11, delay: 0 },
    { freq: A4,  duration: 0.11, delay: 0.14 },
    { freq: A4,  duration: 0.11, delay: 0.28 },
    { freq: A4,  duration: 0.11, delay: 0.42 },
    { freq: A4,  duration: 0.11, delay: 0.56 },
    { freq: D5,  duration: 0.45, delay: 0.72 },
    { freq: D5,  duration: 0.11, delay: 1.28 },
    { freq: D5,  duration: 0.11, delay: 1.42 },
    { freq: D5,  duration: 0.11, delay: 1.56 },
    { freq: G5,  duration: 0.45, delay: 1.72 },
  ],

  // Vivaldi — Spring, Four Seasons (Op. 8 No. 1)
  // The violin's excited opening trill-like motif: E5 D#5 E5 B4 E5 D#5 E5 B4
  Vivaldi: [
    { freq: E5,  duration: 0.13, delay: 0 },
    { freq: Eb5, duration: 0.08, delay: 0.16 },
    { freq: E5,  duration: 0.08, delay: 0.26 },
    { freq: B4,  duration: 0.22, delay: 0.38 },
    { freq: E5,  duration: 0.13, delay: 0.66 },
    { freq: Eb5, duration: 0.08, delay: 0.82 },
    { freq: E5,  duration: 0.08, delay: 0.92 },
    { freq: B4,  duration: 0.50, delay: 1.04 },
  ],
};

export function playComposerTune(composerName: string): StopFn {
  if (typeof window === "undefined") return () => {};

  const motif = MOTIFS[composerName];
  if (!motif) return () => {};

  let ctx: AudioContext | null = null;

  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    motif.forEach(note => {
      const osc   = ctx!.createOscillator();
      const gain  = ctx!.createGain();
      const filter = ctx!.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.value = note.freq;

      filter.type = "lowpass";
      filter.frequency.value = 2200;
      filter.Q.value = 0.8;

      const attack  = 0.015;
      const release = 0.10;
      const startAt = now + note.delay;
      const endAt   = startAt + note.duration;

      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.20, startAt + attack);
      gain.gain.setValueAtTime(0.20, Math.max(startAt + attack, endAt - release));
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
    try { ctx?.close(); } catch { /* ignore */ }
  };
}
