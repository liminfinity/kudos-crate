
-- Survey template types
CREATE TYPE public.survey_type AS ENUM ('half_year_employee', 'bi_month_manager');
CREATE TYPE public.survey_status AS ENUM ('draft', 'open', 'closed');
CREATE TYPE public.assignment_status AS ENUM ('not_started', 'in_progress', 'submitted', 'overdue');

-- Survey Templates
CREATE TABLE public.survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type survey_type NOT NULL,
  version integer NOT NULL DEFAULT 1,
  schema_json jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view templates" ON public.survey_templates FOR SELECT USING (true);
CREATE POLICY "Admin can manage templates" ON public.survey_templates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Survey Cycles
CREATE TABLE public.survey_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.survey_templates(id),
  label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  open_from timestamptz NOT NULL,
  due_date timestamptz NOT NULL,
  status survey_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view cycles" ON public.survey_cycles FOR SELECT USING (true);
CREATE POLICY "Admin can manage cycles" ON public.survey_cycles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Survey Assignments
CREATE TABLE public.survey_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.survey_cycles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  status assignment_status NOT NULL DEFAULT 'not_started',
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, user_id)
);
ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assignments" ON public.survey_assignments FOR SELECT USING (user_id = auth.uid() OR is_manager_or_above(auth.uid()));
CREATE POLICY "Users can update own assignments" ON public.survey_assignments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can manage assignments" ON public.survey_assignments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Survey Responses
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.survey_assignments(id) ON DELETE CASCADE,
  answers_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own responses" ON public.survey_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.survey_assignments sa WHERE sa.id = assignment_id AND (sa.user_id = auth.uid() OR is_manager_or_above(auth.uid())))
);
CREATE POLICY "Users can insert own responses" ON public.survey_responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.survey_assignments sa WHERE sa.id = assignment_id AND sa.user_id = auth.uid())
);
CREATE POLICY "Users can update own responses" ON public.survey_responses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.survey_assignments sa WHERE sa.id = assignment_id AND sa.user_id = auth.uid() AND sa.status != 'submitted')
);
CREATE POLICY "Admin can manage responses" ON public.survey_responses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on responses
CREATE TRIGGER update_survey_responses_updated_at
  BEFORE UPDATE ON public.survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for assignments (for banner notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_assignments;
