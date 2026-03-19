-- ── Studio System ─────────────────────────────────────────────────────────────
-- Run this in your Supabase SQL editor.

-- Shop items catalog (static, seeded below)
create table if not exists shop_items (
  id          text primary key,
  name        text not null,
  category    text not null,       -- 'instrument' | 'furniture' | 'decor' | 'plant' | 'trophy'
  cost_points int  not null default 100,
  emoji       text not null,
  description text,
  rarity      text not null default 'common', -- 'common' | 'rare' | 'epic' | 'legendary'
  is_available boolean not null default true,
  sort_order  int  not null default 0
);

-- Student inventory (what each student owns)
create table if not exists student_inventory (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  item_id      text not null references shop_items(id),
  purchased_at timestamptz not null default now(),
  gifted_by    uuid references profiles(id),
  unique(student_id, item_id)
);

-- RLS
alter table shop_items       enable row level security;
alter table student_inventory enable row level security;

-- shop_items: anyone authenticated can read
create policy "shop_items_read" on shop_items
  for select using (auth.role() = 'authenticated');

-- student_inventory: students read their own; teachers read their studio students
create policy "inventory_own_read" on student_inventory
  for select using (student_id = auth.uid());

create policy "inventory_own_insert" on student_inventory
  for insert with check (student_id = auth.uid());

-- Public read for visiting other studios (any authenticated user can view any inventory)
create policy "inventory_public_read" on student_inventory
  for select using (auth.role() = 'authenticated');

-- ── Seed shop items ──────────────────────────────────────────────────────────

insert into shop_items (id, name, category, cost_points, emoji, description, rarity, sort_order) values

-- Instruments
('grand_piano',      'Grand Piano',        'instrument', 500,  '🎹', 'A magnificent concert grand. The centerpiece of any serious studio.',  'epic',      1),
('upright_piano',    'Upright Piano',      'instrument', 150,  '🎹', 'A classic upright. Every studio starts somewhere.',                    'common',    2),
('violin',           'Violin',             'instrument', 200,  '🎻', 'Handcrafted from aged spruce and maple.',                             'rare',      3),
('cello',            'Cello',              'instrument', 250,  '🎻', 'Rich, warm tones fill the room.',                                     'rare',      4),
('acoustic_guitar',  'Acoustic Guitar',    'instrument', 150,  '🎸', 'Warm nylon strings. Perfect for late-night practice.',               'common',    5),
('harp',             'Concert Harp',       'instrument', 800, '🪗', 'Towering golden strings catch the light.',                            'legendary', 6),
('trumpet',          'Trumpet',            'instrument', 180,  '🎺', 'Polished brass, ready for fanfares.',                                'common',    7),
('french_horn',      'French Horn',        'instrument', 300,  '📯', 'Gleaming coils of brass. Notoriously difficult.',                    'rare',      8),

-- Furniture
('velvet_chair',     'Velvet Chair',       'furniture',  120,  '🪑', 'Deep burgundy velvet. Very composer-appropriate.',                   'common',    10),
('writing_desk',     'Writing Desk',       'furniture',  180,  '🪵', 'Scattered with manuscript paper and pencils.',                       'common',    11),
('bookshelf',        'Music Bookshelf',    'furniture',  200,  '📚', 'Overflowing with scores, theory books, and biographies.',            'common',    12),
('chaise_lounge',    'Chaise Longue',      'furniture',  350,  '🛋️', 'Where Romantic-era composers did their best thinking.',              'rare',      13),
('globe',            'Antique Globe',      'furniture',  280,  '🌍', 'For the composer who sees the whole world as their audience.',       'rare',      14),

-- Decor
('metronome',        'Golden Metronome',   'decor',       80,  '⏱️', 'Ticks away in perfect time. Oddly meditative.',                     'common',    20),
('candelabra',       'Candelabra',         'decor',      150,  '🕯️', 'Five candles flicker and cast long shadows on the walls.',           'common',    21),
('portrait_bach',    'Portrait of Bach',   'decor',      200,  '🖼️', 'The great contrapuntalist stares back, judging your fingering.',     'rare',      22),
('music_stand',      'Ornate Music Stand', 'decor',       90,  '🗒️', 'Carved mahogany. Makes even scales feel important.',                 'common',    23),
('clock',            'Grandfather Clock',  'decor',      320,  '🕰️', 'Its chimes interrupt at exactly the wrong moment.',                  'rare',      24),
('mirror',           'Gilded Mirror',      'decor',      180,  '🪞', 'Essential for watching your posture during practice.',               'common',    25),

-- Plants & Accessories
('fern',             'Boston Fern',        'plant',       60,  '🌿', 'Lush and forgiving. Thrives on neglect.',                           'common',    30),
('orchid',           'White Orchid',       'plant',      120,  '🌸', 'Elegant and temperamental. Like certain composers.',                'rare',      31),
('bonsai',           'Bonsai Tree',        'plant',      250,  '🌳', 'Years of patient cultivation. Sound familiar?',                     'rare',      32),
('rose',             'Vase of Roses',      'plant',       80,  '🌹', 'Red roses on the piano lid. Very dramatic.',                        'common',    33),
('telescope',        'Brass Telescope',    'plant',      300,  '🔭', 'For when practice is done and you need to think bigger.',            'rare',      34),

-- Trophies & Specials
('flame_eternal',    'Eternal Flame',      'trophy',     999,  '🔥', 'Burns forever. Awarded to those who never stop practicing.',         'legendary', 40),
('laurel_wreath',    'Laurel Wreath',      'trophy',     400,  '🏅', 'The ancient symbol of musical victory.',                            'epic',      41),
('crystal_note',     'Crystal Note',       'trophy',     600,  '💎', 'A solid crystal treble clef. Catches light beautifully.',           'epic',      42)

on conflict (id) do nothing;
