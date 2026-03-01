
-- 3. Review 360 Cycles (create table first without cross-ref policies)
CREATE TABLE public.review_360_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  title text NOT NULL,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  open_from timestamptz NOT NULL,
  due_date timestamptz NOT NULL,
  required_reviews_per_user integer NOT NULL DEFAULT 3,
  max_assignments_per_reviewer integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_review_360_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'closed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_review_360_cycle_trigger
BEFORE INSERT OR UPDATE ON public.review_360_cycles
FOR EACH ROW EXECUTE FUNCTION public.validate_review_360_cycle();

ALTER TABLE public.review_360_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage 360 cycles"
ON public.review_360_cycles FOR ALL TO authenticated
USING (is_manager_or_above(auth.uid()));

-- 4. Review 360 Assignments
CREATE TABLE public.review_360_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.review_360_cycles(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  reviewee_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  UNIQUE(cycle_id, reviewer_user_id, reviewee_user_id)
);

CREATE OR REPLACE FUNCTION public.validate_review_360_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('not_started', 'submitted') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.reviewer_user_id = NEW.reviewee_user_id THEN
    RAISE EXCEPTION 'Cannot assign self-review';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_review_360_assignment_trigger
BEFORE INSERT OR UPDATE ON public.review_360_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_review_360_assignment();

ALTER TABLE public.review_360_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers can view own 360 assignments"
ON public.review_360_assignments FOR SELECT TO authenticated
USING (reviewer_user_id = auth.uid() OR is_manager_or_above(auth.uid()));

CREATE POLICY "Reviewers can update own 360 assignments"
ON public.review_360_assignments FOR UPDATE TO authenticated
USING (reviewer_user_id = auth.uid());

CREATE POLICY "Managers can manage 360 assignments"
ON public.review_360_assignments FOR ALL TO authenticated
USING (is_manager_or_above(auth.uid()));

-- Now add the cross-ref policy on cycles
CREATE POLICY "Reviewers can view published 360 cycles"
ON public.review_360_cycles FOR SELECT TO authenticated
USING (status IN ('published', 'closed') AND EXISTS (
  SELECT 1 FROM public.review_360_assignments a WHERE a.cycle_id = review_360_cycles.id AND a.reviewer_user_id = auth.uid()
));

-- 5. Review 360 Responses
CREATE TABLE public.review_360_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.review_360_assignments(id) ON DELETE CASCADE UNIQUE,
  answers_json jsonb NOT NULL DEFAULT '{}',
  text_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_360_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers can insert own 360 responses"
ON public.review_360_responses FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.review_360_assignments a
  WHERE a.id = review_360_responses.assignment_id AND a.reviewer_user_id = auth.uid()
));

CREATE POLICY "Reviewers can update own 360 responses"
ON public.review_360_responses FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.review_360_assignments a
  WHERE a.id = review_360_responses.assignment_id AND a.reviewer_user_id = auth.uid() AND a.status != 'submitted'
));

CREATE POLICY "Managers can view 360 responses"
ON public.review_360_responses FOR SELECT TO authenticated
USING (is_manager_or_above(auth.uid()));
