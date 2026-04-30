// RCM Piano Syllabus 2022 Edition - Structured Requirements by Level
// Source: The Royal Conservatory Piano Syllabus 2022/2023

export interface RCMLevel {
  level: string;
  name: string;
  marks: {
    repertoire: number;
    technicalTests: number;
    etudes: number;
    musicianship: number;
    total: number;
  };
  repertoire: {
    listA?: { name: string; count: number; style: string };
    listB?: { name: string; count: number; style: string };
    listC?: { name: string; count: number; style: string };
    listD?: { name: string; count: number; style: string };
    listE?: { name: string; count: number; style: string };
    listF?: { name: string; count: number; style: string };
    memory: { marksPerPiece: number; totalMarks: number };
  };
  technicalTests: {
    scales: ScaleRequirement[];
    chords: ChordRequirement[];
    arpeggios?: ArpeggioRequirement[];
    chromatic?: ChromaticRequirement;
  };
  musicianship: {
    earTests: EarTest[];
    sightReading: SightReadingTest[];
  };
  etudes: {
    count: number;
    canSubstitutePopular: boolean;
    notes?: string;
  };
}

export interface ScaleRequirement {
  type: string; // "Two-octave", "One-octave", "Pentascale", etc.
  keys: string[];
  tempo: number;
  hands?: "HS" | "HT";
  style?: string; // "legato", "staccato", etc.
}

export interface ChordRequirement {
  type: string; // "Tonic Triads", "Broken", "Solid/blocked", etc.
  keys: string[];
  tempo?: number;
  inversion?: string;
}

export interface ArpeggioRequirement {
  type: string;
  keys: string[];
  tempo?: number;
}

export interface ChromaticRequirement {
  startingNote: string;
  octaves: number;
  hands: "HS" | "HT";
  tempo: number;
}

export interface EarTest {
  skill: string; // "Clapback", "Intervals", "Chords", "Playback"
  description: string;
  marks?: number;
  details?: string;
}

export interface SightReadingTest {
  type: string; // "Rhythm", "Playing"
  marks?: number;
  description: string;
  details?: string;
}

// ──────────────────────────────────────────────────────────────────────
// LEVEL DEFINITIONS
// ──────────────────────────────────────────────────────────────────────

export const RCM_PIANO_LEVELS: Record<string, RCMLevel> = {
  "prep-a": {
    level: "Preparatory A",
    name: "Prep A",
    marks: {
      repertoire: 66,
      technicalTests: 14,
      etudes: 0,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Syllabus List", count: 3, style: "Various" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Pentascale (five-finger patterns)",
          style: "Legato",
          keys: ["C", "G", "D major", "A minor"],
          tempo: 100,
          hands: "HS",
        },
        {
          type: "Pentascale",
          style: "Staccato",
          keys: ["C", "G", "D major", "A minor"],
          tempo: 60,
          hands: "HS",
        },
        {
          type: "One-octave Scale",
          keys: ["C major"],
          tempo: 60,
          hands: "HS",
        },
      ],
      chords: [
        {
          type: "Triad Sequence - Broken",
          keys: ["C", "G", "D major", "A minor"],
          tempo: 60,
        },
        {
          type: "Triad Sequence - Solid/blocked",
          keys: ["C", "G", "D major", "A minor"],
          tempo: 72,
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Clap, tap, or sing the rhythm of a short melody",
          marks: 4,
          details: "Melodies in 2/4 or 4/4, two measures long",
        },
        {
          skill: "Chords",
          description: "Identify major or minor triads",
          marks: 2,
          details: "Root position only",
        },
        {
          skill: "Playback",
          description: "Play back a melody based on first three notes of major scale",
          marks: 4,
          details: "Four notes, starting on tonic or mediant",
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 5,
          description: "Tap steady beat, then speak/clap/tap rhythm",
          details: "2/4 or 4/4, two measures",
        },
        {
          type: "Playing",
          marks: 5,
          description: "Play two four-note melodies",
          details: "One in treble clef (RH), one in bass clef (LH)",
        },
      ],
    },
    etudes: {
      count: 0,
      canSubstitutePopular: false,
      notes: "No etudes at Prep A level",
    },
  },

  "prep-b": {
    level: "Preparatory B",
    name: "Prep B",
    marks: {
      repertoire: 66,
      technicalTests: 14,
      etudes: 0,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Syllabus List", count: 3, style: "Various" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Pentascale - Legato",
          keys: ["D", "A", "F major", "E", "D minor"],
          tempo: 60,
          hands: "HS",
        },
        {
          type: "One-octave Scale - Legato",
          keys: ["C", "G major", "A minor (natural)"],
          tempo: 60,
          hands: "HS",
        },
        {
          type: "One-octave Scale - HT Contrary Motion",
          keys: ["C major"],
          tempo: 60,
          hands: "HT",
        },
      ],
      chords: [
        {
          type: "Tonic Triads - Broken",
          keys: ["C", "G major", "A minor"],
          tempo: 50,
          inversion: "root position and inversions",
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Clap rhythm of short melody",
          marks: 4,
        },
        {
          skill: "Chords",
          description: "Identify major or minor triads",
          marks: 2,
        },
        {
          skill: "Playback",
          description: "Play back melody from scale beginning",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 5,
          description: "Tap steady beat and speak/clap rhythm",
        },
        {
          type: "Playing",
          marks: 5,
          description: "Play short melody divided between hands",
        },
      ],
    },
    etudes: {
      count: 0,
      canSubstitutePopular: false,
    },
  },

  "1": {
    level: "Level 1",
    name: "1",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque and Classical", count: 1, style: "Baroque/Classical" },
      listB: { name: "Romantic, 20th-, 21st-century", count: 1, style: "Romantic onwards" },
      listC: { name: "Inventions", count: 1, style: "Inventions/Pedagogical" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Two-octave Legato",
          keys: ["C", "G", "F major", "A", "E", "D minor (natural and harmonic)"],
          tempo: 69,
          hands: "HS",
        },
        {
          type: "Contrary Motion HT",
          keys: ["C major"],
          tempo: 69,
          hands: "HT",
        },
      ],
      chords: [
        {
          type: "Tonic Triads - Broken",
          keys: ["C", "G", "F major", "A", "E", "D minor"],
          tempo: 50,
        },
        {
          type: "Tonic Triads - Solid/blocked",
          keys: ["C", "G", "F major", "A", "E", "D minor"],
          tempo: 100,
        },
      ],
      chromatic: {
        startingNote: "C",
        octaves: 1,
        hands: "HS",
        tempo: 69,
      },
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Clap rhythm of melody",
          marks: 2,
        },
        {
          skill: "Intervals",
          description: "Identify minor 3rd and major 3rd",
          marks: 2,
          details: "Ascending and descending, melodic form",
        },
        {
          skill: "Chords",
          description: "Identify major or minor triads",
          marks: 2,
          details: "Root position only",
        },
        {
          skill: "Playback",
          description: "Play back melody from major/minor scale",
          marks: 4,
          details: "Five notes, tonic or dominant starting note",
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
          description: "Sight-rhythm reading in 2/4 or 4/4",
          details: "Two measures",
        },
        {
          type: "Playing",
          marks: 7,
          description: "Sight-play four-measure melody",
          details: "Grand staff, divided between hands",
        },
      ],
    },
    etudes: {
      count: 1,
      canSubstitutePopular: true,
      notes: "One etude from Celebration Series or substitutes. Can substitute popular selection.",
    },
  },

  "2": {
    level: "Level 2",
    name: "2",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque and Classical", count: 1, style: "Baroque/Classical" },
      listB: { name: "Romantic, 20th-, 21st-century", count: 1, style: "Romantic onwards" },
      listC: { name: "Inventions", count: 1, style: "Inventions/Pedagogical" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Two-octave Legato",
          keys: ["D", "B flat", "E flat major", "B", "G#", "F# minor (natural and harmonic)"],
          tempo: 76,
          hands: "HS",
        },
        {
          type: "Contrary Motion HT",
          keys: ["G major"],
          tempo: 76,
          hands: "HT",
        },
      ],
      chords: [
        {
          type: "Tonic Triads - Broken",
          keys: ["D", "B flat", "E flat major", "B", "G#", "F# minor"],
          tempo: 60,
        },
        {
          type: "Tonic Triads - Solid/blocked",
          keys: ["D", "B flat", "E flat major", "B", "G#", "F# minor"],
          tempo: 120,
        },
      ],
      chromatic: {
        startingNote: "G or D",
        octaves: 1,
        hands: "HS",
        tempo: 76,
      },
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Clap or sing melody",
          marks: 2,
        },
        {
          skill: "Intervals",
          description: "Identify major 2nd, minor 3rd, major 3rd, perfect 4th, perfect 5th",
          marks: 2,
          details: "Ascending and descending",
        },
        {
          skill: "Chords",
          description: "Identify major, minor, and dominant 7th triads",
          marks: 2,
        },
        {
          skill: "Playback",
          description: "Play back melody from scale beginning",
          marks: 4,
          details: "Five to six notes",
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
          description: "Sight-rhythm reading",
          details: "Varied time signatures, two to three measures",
        },
        {
          type: "Playing",
          marks: 7,
          description: "Sight-play four-to-six-measure melody",
          details: "Grand staff, may include sixteenth notes",
        },
      ],
    },
    etudes: {
      count: 1,
      canSubstitutePopular: true,
      notes: "One etude from Celebration Series. Can substitute popular selection.",
    },
  },

  "3": {
    level: "Level 3",
    name: "3",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1, style: "Baroque" },
      listB: { name: "Classical and Classical-style", count: 1, style: "Classical" },
      listC: { name: "Romantic, 20th-, 21st-century", count: 1, style: "Romantic onwards" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Two-octave Legato",
          keys: ["E", "A flat", "B major", "C# minor (natural and harmonic)"],
          tempo: 84,
          hands: "HS",
        },
        {
          type: "Contrary Motion HT",
          keys: ["D major"],
          tempo: 84,
          hands: "HT",
        },
      ],
      chords: [
        {
          type: "Tonic Triads - Broken and Solid",
          keys: ["E", "A flat", "B major", "C# minor"],
          tempo: 72,
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Clap or sing melody with syncopation",
          marks: 2,
        },
        {
          skill: "Intervals",
          description: "Identify all intervals from minor 2nd to major 7th",
          marks: 2,
          details: "Ascending and descending",
        },
        {
          skill: "Chords",
          description: "Identify major, minor, major 7th, and dominant 7th",
          marks: 2,
        },
        {
          skill: "Playback",
          description: "Play back melody with larger range",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
          description: "Complex rhythm patterns",
          details: "Two to three measures",
        },
        {
          type: "Playing",
          marks: 7,
          description: "Sight-play longer melody",
          details: "May include key signatures and accidentals",
        },
      ],
    },
    etudes: {
      count: 1,
      canSubstitutePopular: true,
    },
  },

  "4": {
    level: "Level 4",
    name: "4",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1, style: "Baroque" },
      listB: { name: "Classical and Classical-style", count: 1, style: "Classical" },
      listC: { name: "Romantic, 20th-, 21st-century", count: 1, style: "Romantic onwards" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Two-octave Legato",
          keys: ["F#", "D flat", "F# minor, B flat minor (natural and harmonic)"],
          tempo: 92,
          hands: "HS",
        },
        {
          type: "Contrary Motion HT",
          keys: ["A major"],
          tempo: 92,
          hands: "HT",
        },
      ],
      chords: [
        {
          type: "Tonic Triads - Broken and Solid",
          keys: ["F#", "D flat", "F# minor", "B flat minor"],
          tempo: 84,
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Clap melody with greater complexity",
          marks: 2,
        },
        {
          skill: "Intervals",
          description: "All intervals from unison to octave",
          marks: 2,
        },
        {
          skill: "Chords",
          description: "Identify major, minor, and 7th chords",
          marks: 2,
        },
        {
          skill: "Playback",
          description: "Play back 8-12 note melody",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
          description: "Dotted rhythms and syncopation",
        },
        {
          type: "Playing",
          marks: 7,
          description: "Sight-play longer piece",
        },
      ],
    },
    etudes: {
      count: 1,
      canSubstitutePopular: true,
    },
  },

  "5": {
    level: "Level 5",
    name: "5",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1, style: "Baroque" },
      listB: { name: "Classical and Classical-style", count: 1, style: "Classical" },
      listC: { name: "Romantic, 20th-, 21st-century", count: 1, style: "Romantic onwards" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Three-octave",
          tempo: 100,
          hands: "HS",
          keys: ["Multiple keys as per syllabus"],
        },
      ],
      chords: [
        {
          type: "Triads in all inversions",
          tempo: 88,
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "More complex melodies",
          marks: 2,
        },
        {
          skill: "Chord Quality",
          description: "Identify major, minor, diminished, augmented",
          marks: 2,
        },
        {
          skill: "Chords & Progressions",
          description: "Identify chord progressions",
          marks: 2,
        },
        {
          skill: "Melody Playback",
          description: "Play back longer melodies",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
          description: "Advanced rhythmic patterns",
        },
        {
          type: "Playing",
          marks: 7,
          description: "Longer sight-reading passages",
        },
      ],
    },
    etudes: {
      count: 2,
      canSubstitutePopular: true,
    },
  },

  "6": {
    level: "Level 6",
    name: "6",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1, style: "Baroque" },
      listB: { name: "Classical and Classical-style", count: 1, style: "Classical" },
      listC: { name: "Romantic, 20th-, 21st-century", count: 1, style: "Romantic onwards" },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Three-octave",
          tempo: 108,
          hands: "HS",
        },
      ],
      chords: [
        {
          type: "Seventh chords in inversions",
          tempo: 96,
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          description: "Complex rhythmic patterns",
          marks: 2,
        },
        {
          skill: "Chord Quality",
          description: "Seventh chords and progressions",
          marks: 2,
        },
        {
          skill: "Chords & Progressions",
          description: "Multi-chord progressions",
          marks: 2,
        },
        {
          skill: "Melody Playback",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
        },
        {
          type: "Playing",
          marks: 7,
          description: "More advanced passages",
        },
      ],
    },
    etudes: {
      count: 2,
      canSubstitutePopular: true,
    },
  },

  "7": {
    level: "Level 7",
    name: "7",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1 },
      listB: { name: "Classical and Classical-style", count: 1 },
      listC: { name: "Romantic, 20th-, 21st-century", count: 1 },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Three-octave",
          tempo: 116,
          hands: "HS",
        },
      ],
      chords: [
        {
          type: "Extended chord voicings",
          tempo: 104,
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          marks: 2,
        },
        {
          skill: "Chord Quality",
          marks: 2,
        },
        {
          skill: "Progressions",
          marks: 2,
        },
        {
          skill: "Playback",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
        },
        {
          type: "Playing",
          marks: 7,
        },
      ],
    },
    etudes: {
      count: 2,
      canSubstitutePopular: true,
    },
  },

  "8": {
    level: "Level 8",
    name: "8",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1 },
      listB: { name: "Classical", count: 1 },
      listC: { name: "Romantic", count: 1 },
      listD: { name: "Post-Romantic, 20th-, 21st-century", count: 1 },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Four-octave",
          tempo: 126,
          hands: "HS",
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          marks: 2,
        },
        {
          skill: "Chords",
          marks: 2,
        },
        {
          skill: "Progressions",
          marks: 2,
        },
        {
          skill: "Playback",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
        },
        {
          type: "Playing",
          marks: 7,
        },
      ],
    },
    etudes: {
      count: 2,
      canSubstitutePopular: true,
      notes: "Memory marks awarded at Level 8",
    },
  },

  "9": {
    level: "Level 9",
    name: "9",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Baroque", count: 1 },
      listB: { name: "Classical", count: 1 },
      listC: { name: "Romantic", count: 1 },
      listD: { name: "Post-Romantic, 20th-, 21st-century", count: 1 },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Four-octave",
          tempo: 138,
          hands: "HS",
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          marks: 2,
        },
        {
          skill: "Chords",
          marks: 2,
        },
        {
          skill: "Progressions",
          marks: 2,
        },
        {
          skill: "Playback",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
        },
        {
          type: "Playing",
          marks: 7,
        },
      ],
    },
    etudes: {
      count: 2,
      canSubstitutePopular: true,
      notes: "Can substitute popular selection for one etude",
    },
  },

  "10": {
    level: "Level 10",
    name: "10",
    marks: {
      repertoire: 50,
      technicalTests: 12,
      etudes: 12,
      musicianship: 20,
      total: 100,
    },
    repertoire: {
      listA: { name: "Works by J.S. Bach", count: 1 },
      listB: { name: "Classical Repertoire", count: 1 },
      listC: { name: "Romantic Repertoire", count: 1 },
      listD: { name: "Post-Romantic, Impressionist, Early 20th-century", count: 1 },
      listE: { name: "20th- and 21st-century Repertoire", count: 1 },
      memory: { marksPerPiece: 2, totalMarks: 6 },
    },
    technicalTests: {
      scales: [
        {
          type: "Four-octave",
          tempo: 152,
          hands: "HS",
        },
      ],
    },
    musicianship: {
      earTests: [
        {
          skill: "Clapback",
          marks: 2,
        },
        {
          skill: "Chords",
          marks: 2,
        },
        {
          skill: "Progressions",
          marks: 2,
        },
        {
          skill: "Playback",
          marks: 4,
        },
      ],
      sightReading: [
        {
          type: "Rhythm",
          marks: 3,
        },
        {
          type: "Playing",
          marks: 7,
        },
      ],
    },
    etudes: {
      count: 2,
      canSubstitutePopular: true,
      notes: "Can substitute popular selection for one etude. One mark deducted per repertoire played with music.",
    },
  },
};

export const getRCMLevel = (level: string): RCMLevel | null => {
  return RCM_PIANO_LEVELS[level.toLowerCase()] || null;
};

export const getAllRCMLevels = (): string[] => {
  return Object.keys(RCM_PIANO_LEVELS);
};
