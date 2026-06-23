import { supabase } from "../lib/supabase";
import { db, ensureDbReady } from "./local";

// ── Sync state ─────────────────────────────────────────────

let isOnline = navigator.onLine;
let syncInProgress = false;

// ── Tables to sync ─────────────────────────────────────────

const SYNC_TABLES = [
  { local: "progress", remote: "progress", primaryKey: "id" },
  { local: "studyProgress", remote: "study_progress", primaryKey: "id" },
  { local: "exerciseProgress", remote: "exercise_progress", primaryKey: "id" },
  { local: "drillQueue", remote: "drill_queue", primaryKey: "id" },
  { local: "verbHistory", remote: "verb_quiz_history", primaryKey: "id" },
] as const;

type LocalTableName = (typeof SYNC_TABLES)[number]["local"];

// ── Track online/offline ───────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isOnline = true;
    runSync().catch((e) => console.error("[sync] online sync failed", e));
  });
  window.addEventListener("offline", () => {
    isOnline = false;
  });
}

// ── Pull: fetch remote rows newer than local watermark ─────

async function pullTable(
  tableName: string,
  lastSync: string | null
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from(tableName)
    .select("*")
    .order("updated_at", { ascending: true });

  if (lastSync) {
    query = query.gt("updated_at", lastSync);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[sync] pull error on", tableName, error);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

// ── Push: sync unsynced local records to server ────────────

async function pushLocalChanges(): Promise<number> {
  const unsynced = await db.versioned
    .where("synced")
    .equals(0)
    .toArray();

  let pushed = 0;

  for (const record of unsynced) {
    const tableName = record.table_name;
    const payload = record.data as Record<string, unknown>;

    const { error } = await supabase.from(tableName).upsert(payload, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("[sync] push error on", tableName, ":", error);
      continue;
    }

    const serverTs = (payload.updated_at as string) ?? new Date().toISOString();
    await db.versioned.update(record.key, {
      synced: true,
      server_updated_at: serverTs,
    });
    pushed++;
  }

  return pushed;
}


// ── Merge remote rows into local Dexie (last-write-wins) ───

async function mergeIntoLocal(
  tableName: LocalTableName,
  remoteRows: Record<string, unknown>[]
): Promise<void> {
  for (const row of remoteRows) {
    const id = row.id as string;
    const versionedKey = `${tableName}::${id}`;

    const localVersion = await db.versioned.get(versionedKey);
    const remoteUpdatedAt = ((row.updated_at ?? row.created_at) ?? "") as string;
    const localUpdatedAt = localVersion?.local_updated_at;

    // Last-write-wins: skip if local is strictly newer
    if (localUpdatedAt && localUpdatedAt > remoteUpdatedAt) {
      continue;
    }

    const table = db[tableName] as any;
    await table.put(row);

    await db.versioned.put({
      key: versionedKey,
      record_id: id,
      table_name: tableName,
      data: row,
      server_updated_at: remoteUpdatedAt,
      local_updated_at: remoteUpdatedAt,
      synced: true,
    });
  }
}


// ── Full sync cycle ────────────────────────────────────────

export async function runSync(): Promise<{
  pulled: number;
  pushed: number;
}> {
  if (syncInProgress) return { pulled: 0, pushed: 0 };
  syncInProgress = true;

  try {
    await ensureDbReady();
    const pushed = await pushLocalChanges();
    let pulled = 0;

    for (const config of SYNC_TABLES) {
      const latestVersions = await db.versioned
        .where("table_name")
        .equals(config.local)
        .reverse()
        .sortBy("local_updated_at");

      const lastSync =
        latestVersions.length > 0
          ? (latestVersions[latestVersions.length - 1]?.server_updated_at ?? null)
          : null;

      const remoteRows = await pullTable(config.remote, lastSync);
      if (remoteRows.length === 0) continue;

      pulled += remoteRows.length;
      await mergeIntoLocal(config.local, remoteRows);
    }

    return { pulled, pushed };
  } finally {
    syncInProgress = false;
  }
}

// ── Convenience: schedule periodic sync ────────────────────

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs = 30_000): void {
  stopPeriodicSync();
  syncIntervalId = setInterval(() => {
    if (isOnline) {
      runSync().catch((e) => console.error("[sync] periodic sync failed", e));
    }
  }, intervalMs);
}

export function stopPeriodicSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
