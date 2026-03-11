-- ============================================================
-- Studio Admin features: Attendance, Contacts, Invoicing
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Attendance status on lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS attendance_status TEXT
  CHECK (attendance_status IN ('present', 'absent', 'late', 'cancelled', 'makeup'));

-- 2. Student contacts (parent / guardian info)
CREATE TABLE IF NOT EXISTS student_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  relationship TEXT DEFAULT 'parent',
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sc_student_idx ON student_contacts(student_id);
CREATE INDEX IF NOT EXISTS sc_studio_idx ON student_contacts(studio_id);

-- 3. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  invoice_number TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inv_studio_idx ON invoices(studio_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS inv_student_idx ON invoices(student_id);

-- 4. Invoice line items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ili_invoice_idx ON invoice_line_items(invoice_id);

-- ============================================================
-- RLS Policies
-- ============================================================

-- student_contacts
ALTER TABLE student_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view contacts for their studio students"
  ON student_contacts FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage contacts for their studio students"
  ON student_contacts FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  );

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view invoices for their studio"
  ON invoices FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage invoices for their studio"
  ON invoices FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  );

-- invoice_line_items (inherit access via invoice)
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view line items via invoice"
  ON invoice_line_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
        UNION
        SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "Teachers can manage line items via invoice"
  ON invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
        UNION
        SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'teacher'
        UNION
        SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
      )
    )
  );
