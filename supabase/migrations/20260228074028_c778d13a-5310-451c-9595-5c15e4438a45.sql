
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('employee', 'manager', 'hr', 'admin');

-- Create sentiment enum  
CREATE TYPE public.sentiment_type AS ENUM ('positive', 'negative');

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_user_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create work_episodes table
CREATE TABLE public.work_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  external_ref TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create subcategories table
CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sentiment sentiment_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.work_episodes(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentiment sentiment_type NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, episode_id),
  CONSTRAINT comment_length CHECK (char_length(comment) >= 10 AND char_length(comment) <= 500),
  CONSTRAINT no_self_feedback CHECK (from_user_id != to_user_id)
);

-- Create feedback_subcategories junction table
CREATE TABLE public.feedback_subcategories (
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, subcategory_id)
);

-- Add foreign key for teams.manager_user_id now that profiles exists
ALTER TABLE public.teams ADD CONSTRAINT fk_teams_manager FOREIGN KEY (manager_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_subcategories ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is manager, hr, or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('manager', 'hr', 'admin')
  )
$$;

-- Helper: get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teams
CREATE POLICY "Authenticated can view teams" ON public.teams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage teams" ON public.teams
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for work_episodes
CREATE POLICY "Authenticated can view episodes" ON public.work_episodes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create episodes" ON public.work_episodes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can manage episodes" ON public.work_episodes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

CREATE POLICY "Admin can delete episodes" ON public.work_episodes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subcategories
CREATE POLICY "Authenticated can view active subcategories" ON public.subcategories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/HR/Admin can manage subcategories" ON public.subcategories
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Manager/HR/Admin can update subcategories" ON public.subcategories
  FOR UPDATE TO authenticated USING (public.is_manager_or_above(auth.uid()));

-- RLS Policies for feedback
CREATE POLICY "Users can insert own feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can update own feedback" ON public.feedback
  FOR UPDATE TO authenticated USING (from_user_id = auth.uid());

CREATE POLICY "Users can view own sent feedback" ON public.feedback
  FOR SELECT TO authenticated USING (
    from_user_id = auth.uid() OR public.is_manager_or_above(auth.uid())
  );

-- RLS Policies for feedback_subcategories
CREATE POLICY "Manage own feedback subcategories" ON public.feedback_subcategories
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.feedback f 
      WHERE f.id = feedback_id AND (f.from_user_id = auth.uid() OR public.is_manager_or_above(auth.uid()))
    )
  );

CREATE POLICY "Insert feedback subcategories" ON public.feedback_subcategories
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.feedback f 
      WHERE f.id = feedback_id AND f.from_user_id = auth.uid()
    )
  );

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for performance
CREATE INDEX idx_feedback_episode ON public.feedback(episode_id);
CREATE INDEX idx_feedback_to_user ON public.feedback(to_user_id);
CREATE INDEX idx_feedback_from_user ON public.feedback(from_user_id);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at);
CREATE INDEX idx_feedback_sentiment ON public.feedback(sentiment);
CREATE INDEX idx_profiles_team ON public.profiles(team_id);
CREATE INDEX idx_work_episodes_date ON public.work_episodes(date);
CREATE INDEX idx_subcategories_sentiment ON public.subcategories(sentiment);
