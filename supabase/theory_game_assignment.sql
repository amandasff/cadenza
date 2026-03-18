-- Add theory_game column to assignments
-- Used when type = 'theory' to specify which game to launch
-- Values: 'noteId' | 'interval' | 'chord' | 'solfege' | 'terms' | 'keySig' | 'scale' | 'fretboard' | 'guitarChord'
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS theory_game TEXT NULL;
