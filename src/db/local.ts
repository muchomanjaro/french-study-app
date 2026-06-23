import Dexie, { type Table } from "dexie";

// ── Local-only types ───────────────────────────────────────

export interface LocalProgress {
  id: string;
  user_id: string;
  exercise_set_id: string;
  status: "not_started" | "in_progress" | "completed";
  score_pct: number | null;
  completed_at: string | null;
  study_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalStudyProgress {
  id: string;
  user_id: string;
  entity_type: "chapter" | "tense";
  entity_id: string;
  study_completed_at: string | null;
  exercises_completed_at: string | null;
  quiz_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalExerciseProgress {
  id: string;
  user_id: string;
  exercise_set_id: string;
  score_pct: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalDrillQueueItem {
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
}

export interface LocalVerbQuizRecord {
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
}

export interface VersionedRecord {
  key: string; // composite: "tableName::recordId"
  record_id: string;
  table_name: string;
  data: unknown;
  server_updated_at: string | null; // timestamp from server on last successful sync
  local_updated_at: string;        // timestamp from local last write
  synced: boolean;                 // false = pending push to server
}

// ── Dexie Database ─────────────────────────────────────────

export class FrenchStudyDB extends Dexie {
  progress!: Table<LocalProgress, string>;
  studyProgress!: Table<LocalStudyProgress, string>;
  exerciseProgress!: Table<LocalExerciseProgress, string>;
  drillQueue!: Table<LocalDrillQueueItem, string>;
  verbHistory!: Table<LocalVerbQuizRecord, string>;
  versioned!: Table<VersionedRecord, string>;

  constructor() {
    super("FrenchStudyDB");

    this.version(1).stores({
      progress: "id, user_id, exercise_set_id, status, updated_at",
      drillQueue: "id, user_id, exercise_set_id, due_at, updated_at",
      verbHistory: "id, user_id, verb_infinitive, tense, quizzed_at",
      versioned: "key, table_name, record_id, server_updated_at, synced, local_updated_at",
    });

    this.version(2).stores({
      progress: "id, user_id, exercise_set_id, status, updated_at",
      drillQueue: "id, user_id, exercise_set_id, due_at, updated_at",
      verbHistory: "id, user_id, verb_infinitive, tense, quizzed_at",
      versioned: "key, table_name, record_id, server_updated_at, synced, local_updated_at",
      studyProgress: "id, user_id, entity_type, entity_id, updated_at",
      exerciseProgress: "id, user_id, exercise_set_id, updated_at",
    }).upgrade(tx => {
      // No data migration needed — study_progress starts empty
    });
  }
}

export const db = new FrenchStudyDB();

// ── Helper: open / ready check ─────────────────────────────

export async function ensureDbReady(): Promise<void> {
  if (db.isOpen()) return;
  await db.open();
}

// ── Helper: clear all local data (e.g. on logout) ──────────

export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    db.progress.clear(),
    db.drillQueue.clear(),
    db.verbHistory.clear(),
    db.versioned.clear(),
  ]);
}
