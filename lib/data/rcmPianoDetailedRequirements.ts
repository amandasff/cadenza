// RCM Piano Syllabus 2022 Edition - Complete Detailed Requirements
// Prep A through Level 2 with all pieces, technique specifications, and musicianship details

export interface RepertoirePiece {
  title: string;
  composer: string;
  source?: string; // Collection name or publisher
  page?: number;
  style?: string;
  inCelebrationSeries?: boolean;
}

export interface ScaleSpec {
  type: string; // "Pentascale Legato", "One-octave", etc.
  keys: string[];
  tempo: number;
  hands: "HS" | "HT";
  style?: string; // "legato", "staccato", etc.
  octaves?: number;
  inversions?: string;
  notes?: string;
}

export interface ChordSpec {
  type: string;
  keys: string[];
  tempo?: number;
  hands?: "HS" | "HT";
  inversions?: string;
  notes?: string;
}

export interface EarTestDetail {
  skill: string;
  description: string;
  timeSignatures?: string[];
  noteValues?: string[];
  details?: string;
  intervals?: string[];
  chordTypes?: string[];
  keys?: string[];
  marks?: number;
  approximateLength?: string;
}

export interface SightReadingDetail {
  type: string;
  description: string;
  timeSignatures?: string[];
  noteValues?: string[];
  approximateLength?: string;
  marks?: number;
  details?: string;
}

export interface RCMLevelDetailed {
  level: string;
  name: string;
  totalMarks: number;
  passMarks: number;

  repertoire: {
    lists: Array<{
      name: string;
      count: number;
      pieces: RepertoirePiece[];
      style?: string;
    }>;
    memoryMarksPerPiece: number;
    memoryMarksCeiling: number;
  };

  technicalTests: {
    scales: ScaleSpec[];
    chords: ChordSpec[];
    arpeggios?: ChordSpec[];
    chromatic?: {
      startingNote: string;
      octaves: number;
      hands: "HS" | "HT";
      tempo: number;
    };
  };

  etudes: {
    count: number;
    list: Array<{
      title: string;
      composer: string;
      source?: string;
      page?: number;
      inCelebrationSeries?: boolean;
    }>;
    canSubstitutePopular?: boolean;
  };

  musicianship: {
    earTests: EarTestDetail[];
    sightReading: SightReadingDetail[];
  };
}

// ──────────────────────────────────────────────────────────────────────
// PREPARATORY A
// ──────────────────────────────────────────────────────────────────────

export const PREP_A: RCMLevelDetailed = {
  level: "Preparatory A",
  name: "Prep A",
  totalMarks: 100,
  passMarks: 60,

  repertoire: {
    lists: [
      {
        name: "Syllabus Repertoire",
        count: 3,
        pieces: [
          { title: "Allegro in C Major, op. 1, no. 4", composer: "Reinagle", inCelebrationSeries: true, page: 4 },
          { title: "Melody in G Major, op. 101, no. 39", composer: "Beyer", inCelebrationSeries: true, page: 5 },
          { title: "The Juggler", composer: "Faber", inCelebrationSeries: true, page: 6 },
          { title: "On the Trampoline", composer: "Niamath", inCelebrationSeries: true, page: 7 },
          { title: "Bluebottle", composer: "Norton", inCelebrationSeries: true, page: 8 },
          { title: "Giraffe", composer: "Richert", inCelebrationSeries: true, page: 9 },
          { title: "Ladybug Waltz", composer: "Ogilvy", inCelebrationSeries: true, page: 10 },
          { title: "Owl in the Night", composer: "Rollin", inCelebrationSeries: true, page: 11 },
          { title: "Bumper Cars", composer: "Olson", inCelebrationSeries: true, page: 12 },
          { title: "The Haunted Mouse", composer: "Faber", inCelebrationSeries: true, page: 14 },
          { title: "Criss Cross", composer: "Price", inCelebrationSeries: true, page: 15 },
          { title: "A Skating Waltz", composer: "Berlin", inCelebrationSeries: true, page: 16 },
          { title: "Sleigh Bells", composer: "Donkin", inCelebrationSeries: true, page: 17 },
          { title: "Barefoot on the Beach", composer: "Crosby Gaudet", inCelebrationSeries: true, page: 18 },
          { title: "Panda Blues", composer: "Jiang", inCelebrationSeries: true, page: 19 },
          { title: "The Haunted Harp", composer: "Donkin", inCelebrationSeries: true, page: 20 },
          { title: "Rock Climbing", composer: "Konecsni", inCelebrationSeries: true, page: 21 },
          { title: "What's That Noise?", composer: "Mier", inCelebrationSeries: true, page: 22 },
          { title: "Around a Roundabout", composer: "Gerou", inCelebrationSeries: true, page: 24 },
          { title: "Prickly Pear Rag", composer: "Alexander", inCelebrationSeries: true, page: 26 },
          { title: "The Wandering Ogre", composer: "Mrozinski", inCelebrationSeries: true, page: 28 },
          { title: "Sleepy Head", composer: "Duncan", inCelebrationSeries: true, page: 29 },
          { title: "Baby Kangaroo", composer: "Crosby Gaudet", inCelebrationSeries: true, page: 30 },
          { title: "Curious Cat", composer: "Richert", inCelebrationSeries: true, page: 31 },
          { title: "Smooth and Crunchy", composer: "Milne", inCelebrationSeries: true, page: 32 },
        ],
        style: "Various"
      }
    ],
    memoryMarksPerPiece: 2,
    memoryMarksCeiling: 6,
  },

  technicalTests: {
    scales: [
      {
        type: "Pentascale (five-finger patterns) - Legato",
        keys: ["C", "G", "D major", "A minor"],
        tempo: 100,
        hands: "HS",
        notes: "Tonic to dominant, ascending and descending (ending with solid/blocked root-position triad)"
      },
      {
        type: "Pentascale - Staccato",
        keys: ["C", "G", "D major", "A minor"],
        tempo: 60,
        hands: "HS",
      },
      {
        type: "One-octave Scale",
        keys: ["C major"],
        tempo: 60,
        hands: "HS",
        octaves: 1,
      }
    ],
    chords: [
      {
        type: "Triad Sequence - Broken",
        keys: ["C", "G", "D major", "A minor"],
        tempo: 60,
        hands: "HS",
      },
      {
        type: "Triad Sequence - Solid/blocked",
        keys: ["C", "G", "D major", "A minor"],
        tempo: 72,
        hands: "HS",
      }
    ]
  },

  etudes: {
    count: 0,
    list: [],
    canSubstitutePopular: false,
  },

  musicianship: {
    earTests: [
      {
        skill: "Clapback",
        description: "Clap, tap, or sing the rhythm of a short melody",
        timeSignatures: ["2/4", "4/4"],
        approximateLength: "Two measures",
        marks: 4,
        details: "Examiner will identify time signature and count one measure before beginning"
      },
      {
        skill: "Chords",
        description: "Identify the quality (major or minor) of a triad",
        chordTypes: ["Major triads", "Minor triads"],
        marks: 2,
        details: "Root position only. Examiner plays first five notes of major/minor scale then tonic triad in solid/blocked form once"
      },
      {
        skill: "Playback",
        description: "Play back a melody based on first three notes of a major scale",
        keys: ["C", "G major", "A minor"],
        approximateLength: "Four notes",
        marks: 4,
        details: "Examiner identifies key, plays tonic triad once, plays melody twice. Movement by step in one direction, may contain repeated note. Fingering indicated for first note only"
      }
    ],
    sightReading: [
      {
        type: "Rhythm",
        description: "Tap steady beat, then speak/tap/clap rhythm",
        timeSignatures: ["2/4", "4/4"],
        approximateLength: "Two measures",
        marks: 5,
        details: "Tap one measure of beat before performing to establish pulse. A steady pulse and metric accentuation are expected"
      },
      {
        type: "Playing",
        description: "Play two four-note melodies",
        approximateLength: "Four notes each",
        marks: 5,
        details: "One melody in treble clef (RH alone), one in bass clef (LH alone). Starting notes: tonic or mediant. Fingering indicated for first note only. Movement by step in one direction, may contain repeated note"
      }
    ]
  }
};

// ──────────────────────────────────────────────────────────────────────
// PREPARATORY B
// ──────────────────────────────────────────────────────────────────────

export const PREP_B: RCMLevelDetailed = {
  level: "Preparatory B",
  name: "Prep B",
  totalMarks: 100,
  passMarks: 60,

  repertoire: {
    lists: [
      {
        name: "Syllabus Repertoire",
        count: 3,
        pieces: [
          { title: "The Calico Cat", composer: "Marlais", inCelebrationSeries: true, page: 4 },
          { title: "A Gorilla Named Chee", composer: "Alexander", inCelebrationSeries: true, page: 5 },
          { title: "The Sneaky Tiger", composer: "Costley", inCelebrationSeries: true, page: 6 },
          { title: "Minuetto in C Major, op. 37, lesson 2", composer: "Hook", inCelebrationSeries: true, page: 8 },
          { title: "Minuet in F Major", composer: "attr. L. Mozart", inCelebrationSeries: true, page: 9 },
          { title: "The Rising Sun", composer: "Telfer", inCelebrationSeries: true, page: 10 },
          { title: "Starfish at Night", composer: "Crosby Gaudet", inCelebrationSeries: true, page: 11 },
          { title: "Raptors", composer: "Olson", inCelebrationSeries: true, page: 12 },
          { title: "Oranges and Lemons", composer: "arr. Berlin", inCelebrationSeries: true, page: 14 },
          { title: "Pumpkin Boogie", composer: "Faber", inCelebrationSeries: true, page: 15 },
          { title: "Boat of Tai Lake", composer: "arr. Lin", inCelebrationSeries: true, page: 16 },
          { title: "The Thirsty Frog", composer: "Athparia", inCelebrationSeries: true, page: 18 },
          { title: "Swoop, Peck and Fly", composer: "Mathews", inCelebrationSeries: true, page: 19 },
          { title: "Sneaky Sam", composer: "Bober", inCelebrationSeries: true, page: 20 },
          { title: "Carillon", composer: "McIntyre", inCelebrationSeries: true, page: 22 },
          { title: "New Shoes", composer: "Niamath", inCelebrationSeries: true, page: 23 },
          { title: "Shadow Puppets", composer: "Jiang", inCelebrationSeries: true, page: 24 },
          { title: "Paswewe", composer: "Assiginaak", inCelebrationSeries: true, page: 25 },
          { title: "Looking-Glass River", composer: "Faber", inCelebrationSeries: true, page: 26 },
          { title: "Leaping the Waves with Dolphins", composer: "Arens", inCelebrationSeries: true, page: 27 },
          { title: "Roda", composer: "Fernández", inCelebrationSeries: true, page: 28 },
          { title: "Playing, op. 39, no. 5", composer: "Kabalevsky", inCelebrationSeries: true, page: 30 },
          { title: "Bouncing Ball", composer: "Richert", inCelebrationSeries: true, page: 31 },
          { title: "Steampunk", composer: "Hidy", inCelebrationSeries: true, page: 32 },
        ],
        style: "Various"
      }
    ],
    memoryMarksPerPiece: 2,
    memoryMarksCeiling: 6,
  },

  technicalTests: {
    scales: [
      {
        type: "Pentascale - Legato",
        keys: ["D", "A", "F major", "E", "D minor"],
        tempo: 60,
        hands: "HS",
        notes: "Tonic to dominant, ascending and descending (ending with solid/blocked root-position triad)"
      },
      {
        type: "One-octave Scale - Legato",
        keys: ["C", "G major", "A minor (natural)"],
        tempo: 60,
        hands: "HS",
        octaves: 1,
      },
      {
        type: "Contrary Motion Scale - HT",
        keys: ["C major"],
        tempo: 60,
        hands: "HT",
        octaves: 1,
      }
    ],
    chords: [
      {
        type: "Tonic Triads - Broken",
        keys: ["C", "G major", "A minor"],
        tempo: 50,
        hands: "HS",
        inversions: "Root position and inversions"
      },
      {
        type: "Tonic Triads - Solid/blocked",
        keys: ["C", "G major", "A minor"],
        tempo: 72,
        hands: "HS",
      }
    ]
  },

  etudes: {
    count: 0,
    list: [],
    canSubstitutePopular: false,
  },

  musicianship: {
    earTests: [
      {
        skill: "Clapback",
        description: "Clap, tap, or sing the rhythm of a short melody",
        timeSignatures: ["2/4", "4/4"],
        approximateLength: "Two measures",
        marks: 4,
      },
      {
        skill: "Chords",
        description: "Identify the quality (major or minor) of a triad",
        chordTypes: ["Major triads", "Minor triads"],
        marks: 2,
        details: "Root position only"
      },
      {
        skill: "Playback",
        description: "Play back a melody based on first three notes of a major or minor scale",
        keys: ["C", "G major", "A minor"],
        approximateLength: "Four notes",
        marks: 4,
      }
    ],
    sightReading: [
      {
        type: "Rhythm",
        description: "Tap steady beat, then speak/tap/clap rhythm",
        timeSignatures: ["2/4", "4/4"],
        approximateLength: "Two measures",
        marks: 5,
      },
      {
        type: "Playing",
        description: "Play a short melody written on the grand staff, divided between hands",
        approximateLength: "Short melody",
        marks: 5,
        details: "Fingering indicated for first note of each hand only"
      }
    ]
  }
};

// ──────────────────────────────────────────────────────────────────────
// LEVEL 1
// ──────────────────────────────────────────────────────────────────────

export const LEVEL_1: RCMLevelDetailed = {
  level: "Level 1",
  name: "1",
  totalMarks: 100,
  passMarks: 60,

  repertoire: {
    lists: [
      {
        name: "List A: Baroque and Classical",
        count: 1,
        pieces: [
          { title: "Minuet in C Major, op. 38, no. 4", composer: "Hässler", inCelebrationSeries: true, page: 4 },
          { title: "Bourrée in D Minor", composer: "Graupner", inCelebrationSeries: true, page: 5 },
          { title: "Burlesque in G Major", composer: "Anonymous", inCelebrationSeries: true, page: 6 },
          { title: "Andante in G Minor", composer: "Telemann", inCelebrationSeries: true, page: 7 },
          { title: "German Dance in D Major, Hob. IX:22, no. 2", composer: "Haydn", inCelebrationSeries: true, page: 8 },
          { title: "Gavotte in G Major", composer: "Dunhill", inCelebrationSeries: true, page: 9 },
          { title: "Minuet in D Major", composer: "L. Mozart", inCelebrationSeries: true, page: 10 },
          { title: "Minuet in D Minor", composer: "Anonymous", inCelebrationSeries: true, page: 11 },
          { title: "High Spirits", composer: "Türk", inCelebrationSeries: true, page: 12 },
          { title: "Ukrainian Folk Song, op. 107, no. 3", composer: "Beethoven", inCelebrationSeries: true, page: 13 },
        ],
        style: "Baroque/Classical"
      },
      {
        name: "List B: Romantic, 20th-, and 21st-century",
        count: 1,
        pieces: [
          { title: "Early One Morning", composer: "arr. Silvester", inCelebrationSeries: true, page: 14 },
          { title: "The Swiss Cuckoo", composer: "arr. Berlin", inCelebrationSeries: true, page: 15 },
          { title: "Sweet Jasmine", composer: "Alexander", inCelebrationSeries: true, page: 16 },
          { title: "Niimi Aandeg", composer: "Assiginaak", inCelebrationSeries: true, page: 40 },
          { title: "This Guy's Disguised", composer: "Sowash", inCelebrationSeries: true, page: 41 },
          { title: "Lunar Eclipse", composer: "Faber", inCelebrationSeries: true, page: 42 },
          { title: "March of the Terrible Trolls", composer: "Niamath", inCelebrationSeries: true, page: 42 },
          { title: "Mist", composer: "Poole", inCelebrationSeries: true, page: 43 },
          { title: "Clear Mountain Sky", composer: "Springer", inCelebrationSeries: true, page: 44 },
          { title: "Angelfish", composer: "Crosby Gaudet", inCelebrationSeries: true, page: 26 },
          { title: "A Simple Waltz", composer: "Burge", inCelebrationSeries: true, page: 36 },
          { title: "Amber Moon", composer: "Olson", inCelebrationSeries: true, page: 28 },
          { title: "Waltz, op. 39, no. 13", composer: "Kabalevsky", inCelebrationSeries: true, page: 30 },
          { title: "Song of the Dark Woods", composer: "Siegmeister", inCelebrationSeries: true, page: 32 },
          { title: "Reminiscence", composer: "McLean", inCelebrationSeries: true, page: 33 },
          { title: "Uptown News", composer: "Gerou", inCelebrationSeries: true, page: 34 },
        ],
        style: "Romantic onwards"
      },
      {
        name: "List C: Inventions",
        count: 1,
        pieces: [
          { title: "Conversation No. 3", composer: "Bartók", inCelebrationSeries: true, page: 38 },
          { title: "Cranky Cat", composer: "Richert", inCelebrationSeries: true, page: 38 },
          { title: "Mary Had a Little Lamb", composer: "arr. Goolkasian Rahbee", inCelebrationSeries: true, page: 39 },
          { title: "Young Ludwig Exploring", composer: "Kinney", inCelebrationSeries: true, page: 40 },
          { title: "The Playful Parrot", composer: "Thomas", inCelebrationSeries: true, page: 40 },
          { title: "The Snake", composer: "Christopher", inCelebrationSeries: true, page: 43 },
          { title: "Invention on a Latvian Folk Tune", composer: "Kenins", inCelebrationSeries: true, page: 44 },
          { title: "Teapot Invention", composer: "Markow", inCelebrationSeries: true, page: 42 },
          { title: "Follow My Leader", composer: "Swinstead", inCelebrationSeries: true, page: 43 },
        ],
        style: "Inventions/Pedagogical"
      }
    ],
    memoryMarksPerPiece: 2,
    memoryMarksCeiling: 6,
  },

  technicalTests: {
    scales: [
      {
        type: "Two-octave - Legato",
        keys: ["C", "G", "F major", "A", "E", "D minor (natural and harmonic)"],
        tempo: 69,
        hands: "HS",
        octaves: 2,
      },
      {
        type: "Contrary Motion - HT",
        keys: ["C major"],
        tempo: 69,
        hands: "HT",
        octaves: 2,
      },
      {
        type: "Chromatic",
        keys: ["C"],
        tempo: 69,
        hands: "HS",
        octaves: 1,
      }
    ],
    chords: [
      {
        type: "Tonic Triads - Broken",
        keys: ["C", "G", "F major", "A", "E", "D minor"],
        tempo: 50,
        hands: "HS",
      },
      {
        type: "Tonic Triads - Solid/blocked",
        keys: ["C", "G", "F major", "A", "E", "D minor"],
        tempo: 100,
        hands: "HS",
      }
    ]
  },

  etudes: {
    count: 1,
    list: [
      { title: "Celebration", composer: "Crosby Gaudet", inCelebrationSeries: true, page: 4 },
      { title: "Etude in C Major, op. 125, no. 3", composer: "Diabelli", inCelebrationSeries: true, page: 5 },
      { title: "Heavenly Blue", composer: "Gerou", inCelebrationSeries: true, page: 6 },
      { title: "Clockwork", composer: "McIntyre", inCelebrationSeries: true, page: 8 },
      { title: "Beaver Boogie", composer: "Chatman", inCelebrationSeries: true, page: 9 },
      { title: "Morning Greeting, op. 117, no. 13", composer: "Gurlitt", inCelebrationSeries: true, page: 10 },
      { title: "Morning Fanfare", composer: "Fernández", inCelebrationSeries: true, page: 11 },
      { title: "Etude in C Major", composer: "Le Couppey", inCelebrationSeries: true, page: 12 },
      { title: "Both Ways", composer: "Tansman", inCelebrationSeries: true, page: 13 },
      { title: "Tricky Traffic", composer: "Garrow", inCelebrationSeries: true, page: 14 },
      { title: "Speedy Comet", composer: "Mathews", inCelebrationSeries: true, page: 16 },
      { title: "Far Away", composer: "Richert", inCelebrationSeries: true, page: 17 },
      { title: "Answering", composer: "Diemer", inCelebrationSeries: true, page: 18 },
      { title: "Jump Pop Hop", composer: "Brown", inCelebrationSeries: true, page: 19 },
      { title: "Melodie in F Major, op. 218, no. 36", composer: "Köhler", inCelebrationSeries: true, page: 20 },
      { title: "Into the Waves", composer: "Niamath", inCelebrationSeries: true, page: 21 },
      { title: "Detectives", composer: "Donkin", inCelebrationSeries: true, page: 22 },
      { title: "Scherzo, op. 39, no. 12", composer: "Kabalevsky", inCelebrationSeries: true, page: 23 },
      { title: "Four-Wheel Drive", composer: "Norton", inCelebrationSeries: true, page: 24 },
    ],
    canSubstitutePopular: true,
  },

  musicianship: {
    earTests: [
      {
        skill: "Clapback",
        description: "Clap, tap, or sing the rhythm of a short melody",
        timeSignatures: ["Various"],
        approximateLength: "Two to three measures",
        marks: 2,
      },
      {
        skill: "Intervals",
        description: "Identify any of the following intervals (ascending and descending)",
        intervals: ["Minor 3rd", "Major 3rd"],
        marks: 2,
        details: "Examiner plays each interval in melodic form (ascending and descending) once, OR student may sing/hum intervals while examiner plays first note once"
      },
      {
        skill: "Chords",
        description: "Identify the quality (major or minor) of a triad",
        chordTypes: ["Major triads", "Minor triads"],
        marks: 2,
        details: "Root position. Examiner plays triad in broken then solid/blocked form once"
      },
      {
        skill: "Playback",
        description: "Play back a melody based on first five notes of a major or minor scale",
        keys: ["C", "G major", "A minor"],
        approximateLength: "Five notes",
        marks: 4,
        details: "Examiner identifies key, plays tonic triad once, plays melody twice. Starting note: tonic or dominant"
      }
    ],
    sightReading: [
      {
        type: "Rhythm",
        description: "Tap steady beat with hand or foot for one measure, then continue tapping while speaking/tapping/clapping the given rhythm",
        timeSignatures: ["Various"],
        approximateLength: "Two measures",
        marks: 3,
        details: "A steady pulse and metric accentuation are expected"
      },
      {
        type: "Playing",
        description: "Play a four-measure melody written on the grand staff and divided between hands",
        keys: ["C", "G", "F major", "A minor"],
        timeSignatures: ["Various"],
        approximateLength: "Four measures",
        marks: 7,
        details: "Fingering indicated for first note of each hand only"
      }
    ]
  }
};

// ──────────────────────────────────────────────────────────────────────
// LEVEL 2
// ──────────────────────────────────────────────────────────────────────

export const LEVEL_2: RCMLevelDetailed = {
  level: "Level 2",
  name: "2",
  totalMarks: 100,
  passMarks: 60,

  repertoire: {
    lists: [
      {
        name: "List A: Baroque and Classical",
        count: 1,
        pieces: [
          { title: "Minuet in C Major, op. 38, no. 4", composer: "Hässler", style: "Baroque" },
          { title: "Bourrée in D Minor", composer: "Graupner", style: "Baroque" },
          { title: "German Dance in D Major, Hob. IX:22, no. 2", composer: "Haydn", style: "Classical" },
          { title: "German Dance in G Major, Hob. IX:22, no. 3", composer: "Haydn", style: "Classical" },
        ],
        style: "Baroque/Classical"
      },
      {
        name: "List B: Romantic, 20th-, and 21st-century",
        count: 1,
        pieces: [
          { title: "Soldier's March, op. 68, no. 2", composer: "Schumann" },
          { title: "Prelude VI", composer: "Kabalevsky" },
          { title: "Theme and Variations, op. 300, no. 39", composer: "Czerny" },
          { title: "Slovakian Folk Tune in E Minor", composer: "Unknown" },
          { title: "Crocodile Tears", composer: "Gerou" },
          { title: "Crocodile Teeth", composer: "Gerou" },
          { title: "I Spy", composer: "Olson" },
          { title: "Atacama Desert", composer: "Olson" },
          { title: "The Merry-Go-Round", composer: "Bober" },
          { title: "The Waltz That Floated Away", composer: "Richert" },
          { title: "Make Believe", composer: "Milne" },
          { title: "The Skating Carnival", composer: "Chatman" },
          { title: "4th Street Rag", composer: "Faber" },
          { title: "Nightingale", composer: "Donkin" },
          { title: "Rhyme Time", composer: "Niamath" },
          { title: "Dreams of a Mermaid", composer: "Crosby Gaudet" },
          { title: "Periwinkle Twinkle", composer: "McLean" },
          { title: "Shadow Waltz", composer: "Assiginaak" },
          { title: "Presto in 5/8", composer: "Gieck" },
          { title: "Farewell, op. 98, no. 4", composer: "Kabalevsky" },
        ],
        style: "Romantic onwards"
      },
      {
        name: "List C: Inventions",
        count: 1,
        pieces: [
          { title: "Invention in C Major", composer: "Bach (simplified or adapted versions)" },
          { title: "Various invention-style pedagogical pieces", composer: "Various contemporary composers" },
        ],
        style: "Inventions/Pedagogical"
      }
    ],
    memoryMarksPerPiece: 2,
    memoryMarksCeiling: 6,
  },

  technicalTests: {
    scales: [
      {
        type: "Two-octave - Legato",
        keys: ["D", "B flat", "E flat major", "B", "G#", "F# minor (natural and harmonic)"],
        tempo: 76,
        hands: "HS",
        octaves: 2,
      },
      {
        type: "Contrary Motion - HT",
        keys: ["G major"],
        tempo: 76,
        hands: "HT",
        octaves: 2,
      },
      {
        type: "Chromatic",
        keys: ["G or D"],
        tempo: 76,
        hands: "HS",
        octaves: 1,
      }
    ],
    chords: [
      {
        type: "Tonic Triads - Broken",
        keys: ["D", "B flat", "E flat major", "B", "G#", "F# minor"],
        tempo: 60,
        hands: "HS",
      },
      {
        type: "Tonic Triads - Solid/blocked",
        keys: ["D", "B flat", "E flat major", "B", "G#", "F# minor"],
        tempo: 120,
        hands: "HS",
      }
    ]
  },

  etudes: {
    count: 1,
    list: [
      { title: "Celebration", composer: "Crosby Gaudet" },
      { title: "Etude in C Major, op. 125, no. 3", composer: "Diabelli" },
      { title: "Heavenly Blue", composer: "Gerou" },
      { title: "Clockwork", composer: "McIntyre" },
      { title: "Beaver Boogie", composer: "Chatman" },
      { title: "Morning Greeting, op. 117, no. 13", composer: "Gurlitt" },
      { title: "Both Ways", composer: "Tansman" },
      { title: "Tricky Traffic", composer: "Garrow" },
      { title: "Far Away", composer: "Richert" },
      { title: "Answering", composer: "Diemer" },
      { title: "Jump Pop Hop", composer: "Brown" },
      { title: "Into the Waves", composer: "Niamath" },
      { title: "Detectives", composer: "Donkin" },
      { title: "Scherzo, op. 39, no. 12", composer: "Kabalevsky" },
      { title: "Four-Wheel Drive", composer: "Norton" },
    ],
    canSubstitutePopular: true,
  },

  musicianship: {
    earTests: [
      {
        skill: "Clapback",
        description: "Clap, tap, or sing the rhythm of a short melody",
        timeSignatures: ["Various"],
        approximateLength: "Two to three measures",
        marks: 2,
      },
      {
        skill: "Intervals",
        description: "Identify any of the following intervals (ascending and descending)",
        intervals: ["Major 2nd", "Minor 3rd", "Major 3rd", "Perfect 4th", "Perfect 5th"],
        marks: 2,
      },
      {
        skill: "Chords",
        description: "Identify the quality of triads",
        chordTypes: ["Major triads", "Minor triads", "Dominant 7th triads"],
        marks: 2,
      },
      {
        skill: "Playback",
        description: "Play back a melody based on scale beginning",
        keys: ["Various"],
        approximateLength: "Five to six notes",
        marks: 4,
      }
    ],
    sightReading: [
      {
        type: "Rhythm",
        description: "Sight-rhythm reading",
        timeSignatures: ["Varied"],
        approximateLength: "Two to three measures",
        marks: 3,
        details: "May include sixteenth notes"
      },
      {
        type: "Playing",
        description: "Sight-play four-to-six-measure melody",
        timeSignatures: ["Varied"],
        approximateLength: "Four to six measures",
        marks: 7,
        details: "Grand staff, may include sixteenth notes"
      }
    ]
  }
};

export const RCM_LEVELS_DETAILED: Record<string, RCMLevelDetailed> = {
  "prep-a": PREP_A,
  "prep-b": PREP_B,
  "1": LEVEL_1,
  "2": LEVEL_2,
};

export const getRCMLevelDetailed = (level: string): RCMLevelDetailed | null => {
  return RCM_LEVELS_DETAILED[level.toLowerCase()] || null;
};

export const getAllRCMLevelsDetailed = (): string[] => {
  return Object.keys(RCM_LEVELS_DETAILED);
};
