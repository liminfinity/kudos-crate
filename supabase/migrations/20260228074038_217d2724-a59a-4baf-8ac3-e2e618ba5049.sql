
-- Fix permissive RLS: restrict episode creation to authenticated users with explicit check
DROP POLICY "Authenticated can create episodes" ON public.work_episodes;
CREATE POLICY "Authenticated can create episodes" ON public.work_episodes
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
