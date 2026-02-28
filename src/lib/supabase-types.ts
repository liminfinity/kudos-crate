// App-level type definitions derived from DB schema
export type AppRole = 'employee' | 'manager' | 'hr' | 'admin';
export type SentimentType = 'positive' | 'negative';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  team_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  manager_user_id: string | null;
  created_at: string;
}

export interface WorkEpisode {
  id: string;
  title: string;
  description: string | null;
  external_ref: string | null;
  date: string;
  team_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Subcategory {
  id: string;
  name: string;
  sentiment: SentimentType;
  is_active: boolean;
  is_critical: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  episode_id: string;
  from_user_id: string;
  to_user_id: string;
  sentiment: SentimentType;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackWithDetails extends Feedback {
  to_user?: Profile;
  episode?: WorkEpisode;
  subcategories?: Subcategory[];
}
