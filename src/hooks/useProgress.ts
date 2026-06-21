import { useState, useEffect, useCallback } from "react";
import Dexie, { type Table } from "dexie";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ExerciseAttempt {
  id?: number;
  exerciseSetId: string;
  score: number;
  completedAt: string;
  synced: boolean;
}

export interface ProgressState {
  attempts: ExerciseAttempt[];
  averageScore: number;
  latestScore: number | null;
  loading: boolean;
  error: string | null;
}

class ProgressDatabase extends Dexie {
  attempts!: Table<ExerciseAttempt, number>;
  constructor() {
    super("FrenchStudyProgress");
    this.version(1).stores({
      attempts: "++id, exerciseSetId, completedAt, synced",
    });
  }
}

let db: ProgressDatabase;
function getDb(): ProgressDatabase {
  if (!db) db = new ProgressDatabase();
  return db;
}

function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) return createClient(url, anonKey);
  return null;
}

export function useProgress(exerciseSetId: string) {
  const [state, setState] = useState<ProgressState>({
    attempts: [],
    averageScore: 0,
    latestScore: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const database = getDb();
        const attempts = await database.attempts
          .where("exerciseSetId")
          .equals(exerciseSetId)
          .toArray();
        if (cancelled) return;
        const count = attempts.length;
        const averageScore = count > 0
          ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / count)
          : 0;
        const latestScore = count > 0 ? attempts[count - 1].score : null;
        setState({ attempts, averageScore, latestScore, loading: false, error: null });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState((p) => ({ ...p, loading: false, error: msg }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [exerciseSetId]);

  const submitScore = useCallback(async (score: number): Promise<void> => {
    const attempt: ExerciseAttempt = {
      exerciseSetId,
      score,
      completedAt: new Date().toISOString(),
      synced: false,
    };
    try {
      const database = getDb();
      const id = await database.attempts.add(attempt);
      setState((prev) => {
        const newAttempts = [...prev.attempts, { ...attempt, id }];
        const avg = Math.round(newAttempts.reduce((s, a) => s + a.score, 0) / newAttempts.length);
        return { attempts: newAttempts, averageScore: avg, latestScore: score, loading: false, error: null };
      });
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { error: supaErr } = await supabase
            .from("exercise_attempts")
            .insert({
              exercise_set_id: exerciseSetId,
              score,
              completed_at: attempt.completedAt,
            });
          if (!supaErr) {
            await database.attempts.update(id, { synced: true });
            setState((prev) => ({
              ...prev,
              attempts: prev.attempts.map((a) => (a.id === id ? { ...a, synced: true } : a)),
            }));
          }
        }
      } catch {
        /* Sync failure is non-fatal */
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit score";
      setState((prev) => ({ ...prev, error: msg }));
    }
  }, [exerciseSetId]);

  return { ...state, submitScore };
}
