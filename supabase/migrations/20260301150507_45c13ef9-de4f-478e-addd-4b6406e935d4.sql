
-- Create feedback_180 table
CREATE TABLE public.feedback_180 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  period TEXT NOT NULL,
  strengths TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  text_long TEXT NOT NULL,
  collaboration_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_180 ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reviews
CREATE POLICY "Users can insert own 180 reviews"
ON public.feedback_180
FOR INSERT
WITH CHECK (from_user_id = auth.uid());

-- Users can view their sent reviews
CREATE POLICY "Users can view own sent 180"
ON public.feedback_180
FOR SELECT
USING (from_user_id = auth.uid() OR is_manager_or_above(auth.uid()));

-- Users can update their own reviews
CREATE POLICY "Users can update own 180"
ON public.feedback_180
FOR UPDATE
USING (from_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_feedback_180_updated_at
BEFORE UPDATE ON public.feedback_180
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
