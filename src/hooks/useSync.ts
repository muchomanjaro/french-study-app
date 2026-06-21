import { useState, useEffect, useCallback, useRef } from "react";
import Dexie, { type Table } from "dexie";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SyncStatus = "online" | "offline" | "syncing" | "error";

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  error: string | null;
  triggerSync: () => Promise<void>;
}

interface ExerciseAttempt {
  id?: number;
  exerciseSetId: string;
  score: number;
  completedAt: string;
  synced: boolean;
}

class SyncDatabase extends Dexie {
  attempts!: Table<ExerciseAttempt, number>;
  constructor() {
    super("FrenchStudyProgress");
    this.version(1).stores({
      attempts: "++id, exerciseSetId, completedAt, synced",
    });
  }
}

let db: SyncDatabase;
function getDb(): SyncDatabase {
  if (!db) db = new SyncDatabase();
  return db;
}

function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) return createClient(url, anonKey);
  return null;
}

export function useSync(): SyncState {
  const [status, setStatus] = useState<SyncStatus>(
    navigator.onLine ? "online" : "offline"
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const database = getDb();
      const count = await database.attempts.where("synced").equals(false).count();
      setPendingCount(count);
    } catch { /* ignore */ }
  }, []);

  const performSync = useCallback(async (): Promise<void> => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setStatus("syncing");
    setError(null);
    try {
      const database = getDb();
      const supabase = getSupabaseClient();
      if (!supabase) {
        setStatus("online");
        setError("Supabase not configured");
        return;
      }
      const unsynced = await database.attempts.where("synced").equals(false).toArray();
      if (unsynced.length === 0) {
        setStatus(navigator.onLine ? "online" : "offline");
        await refreshPendingCount();
        return;
      }
      for (const attempt of unsynced) {
        const { error: supaErr } = await supabase.from("exercise_attempts").insert({
          exercise_set_id: attempt.exerciseSetId,
          score: attempt.score,
          completed_at: attempt.completedAt,
        });
        if (supaErr) continue;
        if (attempt.id !== undefined) {
          await database.attempts.update(attempt.id, { synced: true });
        }
      }
      await refreshPendingCount();
      setStatus(navigator.onLine ? "online" : "offline");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setError(msg);
      setStatus("error");
    } finally {
      syncingRef.current = false;
    }
  }, [refreshPendingCount]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => { setStatus("online"); performSync(); };
    const handleOffline = () => { setStatus("offline"); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [performSync]);

  return { status, pendingCount, error, triggerSync: performSync };
}
