-- Add collection_name and notes to inspirations table
alter table inspirations add column if not exists notes text;
alter table inspirations add column if not exists collection_name text;
