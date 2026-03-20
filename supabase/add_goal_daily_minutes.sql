-- Add daily practice time target to goals
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS target_minutes_per_day INT;
