
-- Table for embed (anonymous/external) survey responses
CREATE TABLE public.embed_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.survey_cycles(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.survey_templates(id),
  answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  respondent_email text,
  source text NOT NULL DEFAULT 'embed',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.embed_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous embed)
CREATE POLICY "Anyone can insert embed responses"
ON public.embed_responses FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only managers+ can view
CREATE POLICY "Managers can view embed responses"
ON public.embed_responses FOR SELECT
TO authenticated
USING (is_manager_or_above(auth.uid()));

-- Admin can manage
CREATE POLICY "Admin can manage embed responses"
ON public.embed_responses FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
