
-- 1. Add is_critical flag to feedback
ALTER TABLE public.feedback ADD COLUMN is_critical boolean NOT NULL DEFAULT false;

-- 2. Create kudos_category enum
CREATE TYPE public.kudos_category AS ENUM (
  'helped_understand',
  'emotional_support',
  'saved_deadline',
  'shared_expertise',
  'mentoring',
  'team_support'
);

-- 3. Create kudos table
CREATE TABLE public.kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  category kudos_category NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own kudos
CREATE POLICY "Users can insert own kudos"
ON public.kudos FOR INSERT
TO authenticated
WITH CHECK (from_user_id = auth.uid());

-- Everyone authenticated can view kudos
CREATE POLICY "Authenticated can view kudos"
ON public.kudos FOR SELECT
TO authenticated
USING (true);

-- 4. Add critical incident subcategories (negative sentiment, will be filtered by is_critical flag)
-- We need a way to mark subcategories as critical
ALTER TABLE public.subcategories ADD COLUMN is_critical boolean NOT NULL DEFAULT false;

INSERT INTO public.subcategories (name, sentiment, is_active, sort_order, is_critical) VALUES
  ('Грубое и неэтичное поведение', 'negative', true, 100, true),
  ('Систематическое затягивание сроков / игнор', 'negative', true, 101, true),
  ('Саботаж работы', 'negative', true, 102, true),
  ('Введение в заблуждение', 'negative', true, 103, true),
  ('Нарушение договорённостей', 'negative', true, 104, true);
