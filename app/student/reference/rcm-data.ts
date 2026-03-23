// RCM Piano Technical Requirements — 2022 Syllabus
// Source: Royal Conservatory of Music 2022 Piano Syllabus + RCM Technical Requirements books
// These are MINIMUM tempos. Always verify with the official RCM Technical Requirements
// book for your specific grade before your exam.

export interface TechItem {
  label: string;
  keys: string;
  hands: string;      // "HS" | "HT" | "RH only"
  octaves: number;
  bpm: number;
  beatUnit: string;   // "♩" | "♪" | "triplet ♪"
  note?: string;
}

export interface TechSection {
  title: string;
  color: string;
  items: TechItem[];
}

export interface GradeData {
  grade: string;
  label: string;
  overview: string;
  milestone?: string;
  tips: string[];
  sections: TechSection[];
}

export const GRADES: GradeData[] = [
  // ── PREPARATORY A ──────────────────────────────────────────────────────────
  {
    grade: "prep-a",
    label: "Prep A",
    overview: "Introduction to 5-finger patterns and basic triads in position.",
    milestone: "First technical work — no full scales yet.",
    tips: [
      "Keep your wrist level and relaxed — no tension in the hand.",
      "Curve your fingers naturally, like holding a small ball.",
      "Staccato means lift the key quickly — don't press harder.",
      "Listen: both hands should sound equally balanced.",
    ],
    sections: [
      {
        title: "Legato Pentascales (5-finger scales)",
        color: "#2471A3",
        items: [
          { label: "C, D, G major; A minor", keys: "C, D, G, Am", hands: "HS", octaves: 1, bpm: 100, beatUnit: "♩", note: "Tonic to dominant, ascending & descending + blocked triad" },
        ],
      },
      {
        title: "Staccato Pentascales",
        color: "#1E8449",
        items: [
          { label: "C, D, G major; A minor", keys: "C, D, G, Am", hands: "HS", octaves: 1, bpm: 100, beatUnit: "♩", note: "Same keys as legato, detached touch" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "C major", keys: "C", hands: "HS", octaves: 1, bpm: 60, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Solid (Blocked) Triads",
        color: "#7D3C98",
        items: [
          { label: "C major", keys: "C", hands: "HS", octaves: 1, bpm: 60, beatUnit: "♩", note: "Quarter note + quarter rest pattern" },
        ],
      },
    ],
  },

  // ── PREPARATORY B ──────────────────────────────────────────────────────────
  {
    grade: "prep-b",
    label: "Prep B",
    overview: "Expanded 5-finger patterns, first contrary motion scale, and introduction to arpeggios.",
    milestone: "First chromatic scale and contrary motion.",
    tips: [
      "Contrary motion: both hands must move together — practice slowly with a metronome.",
      "Chromatic scale: alternate thumb + 3rd finger (white keys), 2nd or 3rd finger on black keys.",
      "Arpeggios: keep the wrist flexible to reach across the octave.",
      "Count eighth notes steadily — don't rush the turn-around at the top.",
    ],
    sections: [
      {
        title: "Legato Pentascales",
        color: "#2471A3",
        items: [
          { label: "D, A, F major; E, D minor", keys: "D, A, F, Em, Dm", hands: "HS", octaves: 1, bpm: 60, beatUnit: "♪", note: "Tonic to dominant + blocked triad" },
        ],
      },
      {
        title: "Staccato Pentascales",
        color: "#1E8449",
        items: [
          { label: "D, A, F major; E, D minor", keys: "D, A, F, Em, Dm", hands: "HS", octaves: 1, bpm: 60, beatUnit: "♪" },
        ],
      },
      {
        title: "Contrary Motion",
        color: "#C0392B",
        items: [
          { label: "C major", keys: "C", hands: "HT", octaves: 1, bpm: 60, beatUnit: "♪", note: "Both hands start on middle C and move outward" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on C", keys: "Chromatic", hands: "HS", octaves: 1, bpm: 60, beatUnit: "♪" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "C, G major; A minor", keys: "C, G, Am", hands: "HS", octaves: 1, bpm: 50, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "C, G major; A minor", keys: "C, G, Am", hands: "HS", octaves: 1, bpm: 80, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 1 ────────────────────────────────────────────────────────────────
  {
    grade: "1",
    label: "Grade 1",
    overview: "First full 2-octave scales with thumbs crossing. Scales are hands separate.",
    milestone: "Introduction to full scales with thumb crossings.",
    tips: [
      "Thumb crossings: pass the thumb under smoothly — no bump in the sound.",
      "Natural minor: same fingering as major, just different notes.",
      "Harmonic minor: the raised 7th gives it a 'dramatic' sound — accent it slightly.",
      "Contrary motion: both hands move outward from middle C simultaneously.",
      "Solid triads: play all notes perfectly together — no arpeggiated roll.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "C, G, F major", keys: "C, G, F", hands: "HS", octaves: 2, bpm: 69, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "A, E, D harmonic minor", keys: "Am, Em, Dm", hands: "HS", octaves: 2, bpm: 69, beatUnit: "♪" },
        ],
      },
      {
        title: "Contrary Motion",
        color: "#C0392B",
        items: [
          { label: "C major", keys: "C", hands: "HT", octaves: 2, bpm: 69, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on C", keys: "Chromatic", hands: "HS", octaves: 1, bpm: 69, beatUnit: "♪" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "C, G, F major", keys: "C, G, F", hands: "HS", octaves: 1, bpm: 50, beatUnit: "triplet ♪" },
          { label: "A, E, D minor", keys: "Am, Em, Dm", hands: "HS", octaves: 1, bpm: 50, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Solid (Blocked) Triads",
        color: "#7D3C98",
        items: [
          { label: "C, G, F major", keys: "C, G, F", hands: "HS", octaves: 1, bpm: 100, beatUnit: "♩" },
          { label: "A, E, D minor", keys: "Am, Em, Dm", hands: "HS", octaves: 1, bpm: 100, beatUnit: "♩" },
        ],
      },
    ],
  },

  // ── GRADE 2 ────────────────────────────────────────────────────────────────
  {
    grade: "2",
    label: "Grade 2",
    overview: "New key signatures including Bb. First formula patterns. Melodic minor introduced.",
    milestone: "Introduction to melodic minor and formula patterns.",
    tips: [
      "Melodic minor: ascending uses raised 6th and 7th; descending reverts to natural minor.",
      "Formula patterns (also called technical exercises): typically involve a specific repeating figure through the key — keep it even and rhythmic.",
      "Bb major: be careful with the Bb fingering — RH uses 4th finger on Bb.",
      "Keep wrists loose on the repeated-note triads.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "G, F, Bb major", keys: "G, F, Bb", hands: "HS", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "E, D, G harmonic minor", keys: "Em, Dm, Gm", hands: "HS", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales",
        color: "#1A5276",
        items: [
          { label: "E, D, G melodic minor", keys: "Em, Dm, Gm", hands: "HS", octaves: 2, bpm: 80, beatUnit: "♪", note: "Raised 6th & 7th ascending; natural descending" },
        ],
      },
      {
        title: "Formula Patterns",
        color: "#1E8449",
        items: [
          { label: "C, G major formula pattern", keys: "C, G", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪", note: "Specific technical pattern through the key — see RCM Technical Requirements book" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on G", keys: "Chromatic", hands: "HS", octaves: 1, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "G, F, Bb major", keys: "G, F, Bb", hands: "HS", octaves: 1, bpm: 60, beatUnit: "triplet ♪" },
          { label: "E, D, G minor", keys: "Em, Dm, Gm", hands: "HS", octaves: 1, bpm: 60, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Solid (Blocked) Triads",
        color: "#7D3C98",
        items: [
          { label: "G, F, Bb major", keys: "G, F, Bb", hands: "HS", octaves: 1, bpm: 112, beatUnit: "♩" },
          { label: "E, D, G minor", keys: "Em, Dm, Gm", hands: "HS", octaves: 1, bpm: 112, beatUnit: "♩" },
        ],
      },
    ],
  },

  // ── GRADE 3 ────────────────────────────────────────────────────────────────
  {
    grade: "3",
    label: "Grade 3",
    overview: "Scales move to hands together for the first time — a major step up in coordination.",
    milestone: "First hands-together scales! This is the biggest jump in Grade 3.",
    tips: [
      "Hands together scales: start extremely slowly — slower than you think you need to.",
      "Listen for evenness: both hands must be identical in volume and timing.",
      "Triads expand to 2 octaves: plan your fingering change at the top carefully.",
      "D major formula pattern: keep the recurring pattern figure smooth, not accented.",
      "Chromatic HT: your thumb crossings in both hands happen at slightly different points — work this out carefully.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "D, F, Bb major", keys: "D, F, Bb", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "B, D, G harmonic minor", keys: "Bm, Dm, Gm", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales",
        color: "#1A5276",
        items: [
          { label: "B, D, G melodic minor", keys: "Bm, Dm, Gm", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Pattern",
        color: "#1E8449",
        items: [
          { label: "D major", keys: "D", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on D", keys: "Chromatic", hands: "HT", octaves: 1, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "D, F, Bb major", keys: "D, F, Bb", hands: "HS", octaves: 2, bpm: 69, beatUnit: "triplet ♪" },
          { label: "B, D, G minor", keys: "Bm, Dm, Gm", hands: "HS", octaves: 2, bpm: 69, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Solid (Blocked) Triads",
        color: "#7D3C98",
        items: [
          { label: "D, F, Bb major", keys: "D, F, Bb", hands: "HS", octaves: 2, bpm: 120, beatUnit: "♩" },
          { label: "B, D, G minor", keys: "Bm, Dm, Gm", hands: "HS", octaves: 2, bpm: 120, beatUnit: "♩" },
        ],
      },
    ],
  },

  // ── GRADE 4 ────────────────────────────────────────────────────────────────
  {
    grade: "4",
    label: "Grade 4",
    overview: "Arpeggios introduced for the first time. Chords now played hands together.",
    milestone: "First year of arpeggios — a brand new skill to develop.",
    tips: [
      "Arpeggios: the key is wrist rotation. As you cross the thumb, rotate the wrist outward slightly to set up the next position.",
      "Practice arpeggios in small groups of 3 notes at first, then connect them.",
      "HT broken triads: listen for perfectly synchronized triplets between the hands.",
      "Eb major scale: be comfortable with the fingering (2nd finger on Bb for RH).",
      "C harmonic minor formula pattern: the augmented 2nd interval (Ab to B) is a characteristic sound — don't smooth it out.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "D, A, Bb, Eb major", keys: "D, A, Bb, Eb", hands: "HT", octaves: 2, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "B, C, G harmonic minor", keys: "Bm, Cm, Gm", hands: "HT", octaves: 2, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales",
        color: "#1A5276",
        items: [
          { label: "B, C, G melodic minor", keys: "Bm, Cm, Gm", hands: "HT", octaves: 2, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Pattern",
        color: "#1E8449",
        items: [
          { label: "C harmonic minor", keys: "Cm", hands: "HT", octaves: 2, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on C", keys: "Chromatic", hands: "HS", octaves: 1, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "D, A, Bb, Eb major", keys: "D, A, Bb, Eb", hands: "HT", octaves: 2, bpm: 60, beatUnit: "triplet ♪" },
          { label: "B, C, G minor", keys: "Bm, Cm, Gm", hands: "HT", octaves: 2, bpm: 60, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Solid (Blocked) Triads",
        color: "#7D3C98",
        items: [
          { label: "D, A, Bb, Eb major", keys: "D, A, Bb, Eb", hands: "HT", octaves: 2, bpm: 120, beatUnit: "♩" },
          { label: "B, C, G minor", keys: "Bm, Cm, Gm", hands: "HT", octaves: 2, bpm: 120, beatUnit: "♩" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "D, A, Bb, Eb major", keys: "D, A, Bb, Eb", hands: "HS", octaves: 2, bpm: 72, beatUnit: "♪" },
          { label: "B, C, G minor", keys: "Bm, Cm, Gm", hands: "HS", octaves: 2, bpm: 72, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 5 ────────────────────────────────────────────────────────────────
  {
    grade: "5",
    label: "Grade 5",
    overview: "Dominant 7th chords introduced. Triads now end with I-V-I cadences. Faster tempos.",
    milestone: "Introduction of dominant 7th chords and tonic cadences.",
    tips: [
      "I-V-I cadence: after your triads, play root-position tonic → first-inversion dominant → root-position tonic. Keep it musical, not mechanical.",
      "Dom 7th chord: root + major 3rd + perfect 5th + minor 7th. Great ear-training opportunity.",
      "Ab major scale: all black keys except C and F — use the 'group' fingering (2-3 for Db-Eb group; 2-3-4 for Ab-Bb group).",
      "Arpeggios HS: at ♪ = 80, you need smooth wrist rotation and a consistent sound across all registers.",
      "Formula patterns: two patterns now (A major + A harmonic minor) — know which is which.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "A, E, F, Ab major", keys: "A, E, F, Ab", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "A, E, F harmonic minor", keys: "Am, Em, Fm", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales",
        color: "#1A5276",
        items: [
          { label: "A, E, F melodic minor", keys: "Am, Em, Fm", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Patterns",
        color: "#1E8449",
        items: [
          { label: "A major", keys: "A", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
          { label: "A harmonic minor", keys: "Am", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on A or F", keys: "Chromatic", hands: "HT", octaves: 1, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Broken Triads",
        color: "#B85C3A",
        items: [
          { label: "A, E, F, Ab major", keys: "A, E, F, Ab", hands: "HT", octaves: 2, bpm: 66, beatUnit: "triplet ♪", note: "Ending with I-V-I cadence" },
          { label: "A, E, F minor", keys: "Am, Em, Fm", hands: "HT", octaves: 2, bpm: 66, beatUnit: "triplet ♪", note: "Ending with I-V-I cadence" },
        ],
      },
      {
        title: "Solid (Blocked) Triads",
        color: "#7D3C98",
        items: [
          { label: "A, E, F, Ab major", keys: "A, E, F, Ab", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♩", note: "Ending with I-V-I cadence" },
          { label: "A, E, F minor", keys: "Am, Em, Fm", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♩", note: "Ending with I-V-I cadence" },
        ],
      },
      {
        title: "Dominant 7th Chords — Broken",
        color: "#884EA0",
        items: [
          { label: "A, E, F, Ab major keys", keys: "A, E, F, Ab", hands: "HS", octaves: 1, bpm: 72, beatUnit: "♪" },
        ],
      },
      {
        title: "Dominant 7th Chords — Solid",
        color: "#6C3483",
        items: [
          { label: "A, E, F, Ab major keys", keys: "A, E, F, Ab", hands: "HS", octaves: 1, bpm: 60, beatUnit: "♩" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "A, E, F, Ab major", keys: "A, E, F, Ab", hands: "HS", octaves: 2, bpm: 80, beatUnit: "♪" },
          { label: "A, E, F minor", keys: "Am, Em, Fm", hands: "HS", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 6 ────────────────────────────────────────────────────────────────
  {
    grade: "6",
    label: "Grade 6",
    overview: "Introduction of chord inversions, leading-tone diminished 7th chords, and I-IV-V cadences.",
    milestone: "First diminished 7th chords and inverted chords.",
    tips: [
      "Chord inversions: memorize the 1st and 2nd inversion fingerings for each triad — they are different from root position.",
      "Leading-tone dim 7th: this chord is symmetrical — every inversion looks the same. Use this to your advantage.",
      "Dominant 7th with inversions: know all four positions (root, 1st, 2nd, 3rd inversion).",
      "I-IV-V6/5-I cadence: practice this as a unit, not individual chords.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "C, Db, D, Eb, E, F major", keys: "C, Db, D, Eb, E, F", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "C, C#, D, Eb, E, F harmonic minor", keys: "Cm, C#m, Dm, Ebm, Em, Fm", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales",
        color: "#1A5276",
        items: [
          { label: "C, C#, D, Eb, E, F melodic minor", keys: "Cm, C#m, Dm, Ebm, Em, Fm", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Patterns",
        color: "#1E8449",
        items: [
          { label: "C harmonic minor, Db harmonic minor", keys: "Cm, Dbm", hands: "HT", octaves: 2, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on C or Db", keys: "Chromatic", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Triads with Inversions",
        color: "#B85C3A",
        items: [
          { label: "All keys — broken, with inversions + I-IV-V cadence", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 66, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Dominant 7th Chords with Inversions",
        color: "#884EA0",
        items: [
          { label: "All keys — broken and solid", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♪" },
        ],
      },
      {
        title: "Leading-Tone Diminished 7th Arpeggios",
        color: "#6C3483",
        items: [
          { label: "All keys — root position", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "All keys — root position", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 7 ────────────────────────────────────────────────────────────────
  {
    grade: "7",
    label: "Grade 7",
    overview: "Four-octave scales introduced. Larger range of keys. Extended chord inversions.",
    milestone: "First four-octave scales — requires full keyboard range.",
    tips: [
      "4-octave scales: you need to know exactly where each position shift happens. Mark them in pencil.",
      "Practice scales in 2-octave blocks first, then connect smoothly.",
      "Dim 7th arpeggios: the symmetrical nature means each inversion is 3 semitones apart — all four positions are equally important.",
      "Keep your shoulders relaxed as you travel up 4 octaves.",
    ],
    sections: [
      {
        title: "Major Scales",
        color: "#2471A3",
        items: [
          { label: "Gb, G, Ab, A, Bb, B major", keys: "Gb, G, Ab, A, Bb, B", hands: "HT", octaves: 4, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales",
        color: "#154360",
        items: [
          { label: "F#, G, Ab, A, Bb, B harmonic minor", keys: "F#m, Gm, Abm, Am, Bbm, Bm", hands: "HT", octaves: 4, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales",
        color: "#1A5276",
        items: [
          { label: "F#, G, Ab, A, Bb, B melodic minor", keys: "F#m, Gm, Abm, Am, Bbm, Bm", hands: "HT", octaves: 4, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Patterns",
        color: "#1E8449",
        items: [
          { label: "F# harmonic minor, G harmonic minor", keys: "F#m, Gm", hands: "HT", octaves: 4, bpm: 92, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on F# or G", keys: "Chromatic", hands: "HT", octaves: 4, bpm: 88, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Triads with Inversions",
        color: "#B85C3A",
        items: [
          { label: "All keys — broken + solid + cadences", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 72, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Dominant 7th with Inversions",
        color: "#884EA0",
        items: [
          { label: "All keys", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♪" },
        ],
      },
      {
        title: "Leading-Tone Diminished 7th Arpeggios",
        color: "#6C3483",
        items: [
          { label: "All keys — root position", keys: "All 6 keys", hands: "HT", octaves: 4, bpm: 66, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "All keys", keys: "All 6 keys", hands: "HT", octaves: 4, bpm: 66, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 8 ────────────────────────────────────────────────────────────────
  {
    grade: "8",
    label: "Grade 8",
    overview: "All 12 major and minor keys. Four-octave scales. Scales in octaves (parallel staccato).",
    milestone: "All 12 keys mastered. Introduction of scale-in-octaves technique.",
    tips: [
      "Scales in octaves (staccato): use wrist weight and rebound — don't grip or press.",
      "Practice octave scales with a very loose, bouncy wrist. Think 'drop and catch.'",
      "4-note tonic chords: all 4 inversions of the seventh chord — know the fingering for each.",
      "At this level, evenness of tone across all 4 octaves is critical — record yourself.",
    ],
    sections: [
      {
        title: "Major Scales — 4 octaves",
        color: "#2471A3",
        items: [
          { label: "All 12 major keys", keys: "All 12", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor Scales — 4 octaves",
        color: "#154360",
        items: [
          { label: "All 12 harmonic minor keys", keys: "All 12", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor Scales — 4 octaves",
        color: "#1A5276",
        items: [
          { label: "All 12 melodic minor keys", keys: "All 12", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Patterns",
        color: "#1E8449",
        items: [
          { label: "Eb major, Eb harmonic minor", keys: "Eb, Ebm", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on Eb", keys: "Chromatic", hands: "HT", octaves: 4, bpm: 96, beatUnit: "♪" },
        ],
      },
      {
        title: "Scales in Octaves (staccato)",
        color: "#A93226",
        items: [
          { label: "Selected major and minor scales", keys: "Examiner selects", hands: "HT", octaves: 2, bpm: 60, beatUnit: "♩", note: "Blocked octaves, detached — wrist rebound technique" },
        ],
      },
      {
        title: "Tonic 4-Note Chords with Inversions",
        color: "#B85C3A",
        items: [
          { label: "All keys — broken + solid + I-IV-V cadence", keys: "All 12", hands: "HT", octaves: 2, bpm: 66, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Dominant 7th with Inversions",
        color: "#884EA0",
        items: [
          { label: "All keys", keys: "All 12", hands: "HT", octaves: 2, bpm: 66, beatUnit: "♪" },
        ],
      },
      {
        title: "Leading-Tone Dim 7th Arpeggios",
        color: "#6C3483",
        items: [
          { label: "All keys — root position", keys: "All 12", hands: "HT", octaves: 4, bpm: 66, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "All keys", keys: "All 12", hands: "HT", octaves: 4, bpm: 80, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 9 ────────────────────────────────────────────────────────────────
  {
    grade: "9",
    label: "Grade 9",
    overview: "Chromatic octave scales. Scales examined from 6 specific key groups. Extended arpeggios.",
    tips: [
      "Chromatic octave scales: every note is a parallel octave — demands total control of both thumbs simultaneously.",
      "Focus on the 6 specific key groups assigned for this year — deep knowledge of each.",
      "At this level, your technique should sound natural and musical, not mechanical — phrasing matters even in technical work.",
      "Record and listen critically — your teacher's ear might catch unevenness you don't notice.",
    ],
    sections: [
      {
        title: "Major Scales — 4 octaves",
        color: "#2471A3",
        items: [
          { label: "C, Db, D, Eb, E, F major", keys: "C, Db, D, Eb, E, F", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor — 4 octaves",
        color: "#154360",
        items: [
          { label: "C, C#, D, Eb, E, F harmonic minor", keys: "Cm, C#m, Dm, Ebm, Em, Fm", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor — 4 octaves",
        color: "#1A5276",
        items: [
          { label: "C, C#, D, Eb, E, F melodic minor", keys: "Cm, C#m, Dm, Ebm, Em, Fm", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Formula Patterns",
        color: "#1E8449",
        items: [
          { label: "C# harmonic minor, F harmonic minor", keys: "C#m, Fm", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on C", keys: "Chromatic", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Scales in Octaves (staccato)",
        color: "#A93226",
        items: [
          { label: "Selected keys — harmonic and melodic minor", keys: "Examiner selects", hands: "HT", octaves: 2, bpm: 60, beatUnit: "♩" },
        ],
      },
      {
        title: "Tonic Chords + Cadences",
        color: "#B85C3A",
        items: [
          { label: "All 6 keys — full inversions + cadences", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 72, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Dominant 7th + Dim 7th Arpeggios",
        color: "#6C3483",
        items: [
          { label: "All 6 keys — 4 octaves", keys: "All 6 keys", hands: "HT", octaves: 4, bpm: 72, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "All 6 keys — 4 octaves", keys: "All 6 keys", hands: "HT", octaves: 4, bpm: 88, beatUnit: "♪" },
        ],
      },
    ],
  },

  // ── GRADE 10 ────────────────────────────────────────────────────────────────
  {
    grade: "10",
    label: "Grade 10",
    overview: "Scales in 3rds and 6ths. The second group of 6 keys. Highest pre-ARCT level.",
    milestone: "Scales separated by 3rds and 6ths — most demanding scale technique in RCM.",
    tips: [
      "Scales in 3rds: both voices must be perfectly even — the lower voice often overpowers. Work each hand's 3rd separately.",
      "Scales in 6ths: similar to 3rds but the interval is wider. Focus on smooth thumb crossings in both layers.",
      "At Grade 10, technical work should be completely fluent — the examiner is listening for musicality and control, not just notes.",
      "Maintain a consistent legato tone even at fast tempos — no accent on the thumb.",
    ],
    sections: [
      {
        title: "Major Scales — 4 octaves",
        color: "#2471A3",
        items: [
          { label: "Gb, G, Ab, A, Bb, B major", keys: "Gb, G, Ab, A, Bb, B", hands: "HT", octaves: 4, bpm: 120, beatUnit: "♪" },
        ],
      },
      {
        title: "Harmonic Minor — 4 octaves",
        color: "#154360",
        items: [
          { label: "F#, G, Ab, A, Bb, B harmonic minor", keys: "F#m, Gm, Abm, Am, Bbm, Bm", hands: "HT", octaves: 4, bpm: 120, beatUnit: "♪" },
        ],
      },
      {
        title: "Melodic Minor — 4 octaves",
        color: "#1A5276",
        items: [
          { label: "F#, G, Ab, A, Bb, B melodic minor", keys: "F#m, Gm, Abm, Am, Bbm, Bm", hands: "HT", octaves: 4, bpm: 120, beatUnit: "♪" },
        ],
      },
      {
        title: "Scales Separated by a 3rd — 4 octaves",
        color: "#1E6E52",
        items: [
          { label: "Selected keys", keys: "Examiner selects", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪", note: "Both voices legato simultaneously" },
        ],
      },
      {
        title: "Scales Separated by a 6th — 4 octaves",
        color: "#0E6655",
        items: [
          { label: "Selected keys", keys: "Examiner selects", hands: "HT", octaves: 4, bpm: 104, beatUnit: "♪", note: "Both voices legato simultaneously" },
        ],
      },
      {
        title: "Scales in Octaves (staccato)",
        color: "#A93226",
        items: [
          { label: "Selected keys", keys: "Examiner selects", hands: "HT", octaves: 2, bpm: 80, beatUnit: "♩" },
        ],
      },
      {
        title: "Chromatic Scale",
        color: "#D35400",
        items: [
          { label: "Starting on Gb or G", keys: "Chromatic", hands: "HT", octaves: 2, bpm: 88, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Chords + Cadences",
        color: "#B85C3A",
        items: [
          { label: "All 6 keys — full inversions + cadences", keys: "All 6 keys", hands: "HT", octaves: 2, bpm: 80, beatUnit: "triplet ♪" },
        ],
      },
      {
        title: "Dominant 7th + Dim 7th Arpeggios",
        color: "#6C3483",
        items: [
          { label: "All 6 keys — 4 octaves", keys: "All 6 keys", hands: "HT", octaves: 4, bpm: 80, beatUnit: "♪" },
        ],
      },
      {
        title: "Tonic Arpeggios",
        color: "#117A65",
        items: [
          { label: "All 6 keys — 4 octaves", keys: "All 6 keys", hands: "HT", octaves: 4, bpm: 96, beatUnit: "♪" },
        ],
      },
    ],
  },
];
