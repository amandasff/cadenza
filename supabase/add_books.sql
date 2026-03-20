-- Books library: books, book pages, and goal/piece linkages

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id  UUID REFERENCES studios(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  publisher  TEXT,
  cover_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Book pages table
CREATE TABLE IF NOT EXISTS book_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  image_url   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_number)
);

-- Add completed_at to goals for dictation book ordering
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add book_id FK to pieces
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

-- RLS: books
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers can manage own books"
  ON books FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "studio members can view books"
  ON books FOR SELECT
  USING (
    studio_id IS NOT NULL AND
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS: book_pages
ALTER TABLE book_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher can manage book pages"
  ON book_pages FOR ALL
  USING (
    book_id IN (SELECT id FROM books WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    book_id IN (SELECT id FROM books WHERE teacher_id = auth.uid())
  );

CREATE POLICY "studio members can view book pages"
  ON book_pages FOR SELECT
  USING (
    book_id IN (
      SELECT b.id FROM books b
      JOIN profiles p ON p.studio_id = b.studio_id
      WHERE p.id = auth.uid()
    )
  );

-- Storage bucket for book page images (run once in Supabase dashboard if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('book-pages', 'book-pages', true)
-- ON CONFLICT DO NOTHING;
