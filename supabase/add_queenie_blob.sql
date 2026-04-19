-- Add Queenie's Blob collectible
INSERT INTO public.composer_avatars
  (composer_name, era, rarity, image_path, fun_fact, unlock_hint, drop_weight, sort_order, is_active)
VALUES
  (
    'Queenie''s Blob',
    'student_art',
    'legendary',
    '/composers/queenie.jpg',
    'Queenie is a ukelele player from Hamilton. This is one of her origional drawings! Check out her music at cadenza.studio/queenie.',
    'A special collectible featuring original student artwork.',
    2,
    20,
    true
  )
ON CONFLICT (composer_name) DO NOTHING;
