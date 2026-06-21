import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types matching the Supabase schema ──────────────────────

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  target_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;
  created_at: string;
  updated_at: string;
};

export type Progress = {
  id: string;
  user_id: string;
  exercise_set_id: string;
  status: "not_started" | "in_progress" | "completed";
  score_pct: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DrillQueueItem = {
  id: string;
  user_id: string;
  exercise_set_id: string;
  item_id: string;
  blank_id: string;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VerbQuizRecord = {
  id: string;
  user_id: string;
  verb_infinitive: string;
  tense: string;
  pronoun_index: number;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  quizzed_at: string;
  created_at: string;
};
