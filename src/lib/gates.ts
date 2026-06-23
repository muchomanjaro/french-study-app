import { db } from "../db/local";
import type { LocalStudyProgress, LocalExerciseProgress } from "../db/local";

// ── Study state types ──────────────────────────────────────

export interface ChapterProgressState {
  studyDone: boolean;
  exercisesDone: number;
  exercisesTotal: number;
  quizDone: boolean;
}

export interface TenseProgressState {
  studyDone: boolean;
  quizDone: boolean;
}

export interface StudyState {
  chapterProgress: Map<string, ChapterProgressState>;
  tenseProgress: Map<string, TenseProgressState>;
  loading: boolean;
  overallPct: number;
}

// ── Progress query functions ───────────────────────────────

/** Get all study progress entries for the current user */
export async function getStudyProgress(userId: string): Promise<LocalStudyProgress[]> {
  return db.studyProgress
    .where("user_id")
    .equals(userId)
    .toArray();
}

/** Get all exercise progress entries for the current user */
export async function getExerciseProgress(userId: string): Promise<LocalExerciseProgress[]> {
  return db.exerciseProgress
    .where("user_id")
    .equals(userId)
    .toArray();
}

/** Mark a chapter or tense as studied */
export async function markStudyComplete(
  userId: string,
  entityType: "chapter" | "tense",
  entityId: string
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.studyProgress
    .where({ user_id: userId, entity_type: entityType, entity_id: entityId })
    .first();

  if (existing) {
    await db.studyProgress.update(existing.id, {
      study_completed_at: now,
      updated_at: now,
    });
  } else {
    await db.studyProgress.put({
      id: crypto.randomUUID(),
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      study_completed_at: now,
      exercises_completed_at: null,
      quiz_completed_at: null,
      created_at: now,
      updated_at: now,
    });
  }
}

/** Mark an exercise set as completed with score */
export async function markExerciseComplete(
  userId: string,
  exerciseSetId: string,
  scorePct: number
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.exerciseProgress
    .where({ user_id: userId, exercise_set_id: exerciseSetId })
    .first();

  if (existing) {
    await db.exerciseProgress.update(existing.id, {
      score_pct: scorePct,
      completed_at: now,
      updated_at: now,
    });
  } else {
    await db.exerciseProgress.put({
      id: crypto.randomUUID(),
      user_id: userId,
      exercise_set_id: exerciseSetId,
      score_pct: scorePct,
      completed_at: now,
      created_at: now,
      updated_at: now,
    });
  }
}

/** Mark a quiz/Bilan as completed for a chapter or tense */
export async function markQuizComplete(
  userId: string,
  entityType: "chapter" | "tense",
  entityId: string
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.studyProgress
    .where({ user_id: userId, entity_type: entityType, entity_id: entityId })
    .first();

  if (existing) {
    await db.studyProgress.update(existing.id, {
      quiz_completed_at: now,
      updated_at: now,
    });
  } else {
    await db.studyProgress.put({
      id: crypto.randomUUID(),
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      study_completed_at: null,
      exercises_completed_at: null,
      quiz_completed_at: now,
      created_at: now,
      updated_at: now,
    });
  }
}

/** Check if a chapter has been studied */
export async function isChapterStudied(userId: string, chapterId: string): Promise<boolean> {
  const entry = await db.studyProgress
    .where({ user_id: userId, entity_type: "chapter", entity_id: chapterId })
    .first();
  return entry?.study_completed_at !== null && entry?.study_completed_at !== undefined;
}

/** Check if a tense has been studied */
export async function isTenseStudied(userId: string, tenseId: string): Promise<boolean> {
  const entry = await db.studyProgress
    .where({ user_id: userId, entity_type: "tense", entity_id: tenseId })
    .first();
  return entry?.study_completed_at !== null && entry?.study_completed_at !== undefined;
}

/** Get all studied chapters */
export async function getStudiedChapters(userId: string): Promise<string[]> {
  const entries = await db.studyProgress
    .where({ user_id: userId, entity_type: "chapter" })
    .filter(sp => sp.study_completed_at !== null)
    .toArray();
  return entries.map(e => e.entity_id);
}

/** Get all studied tenses */
export async function getStudiedTenses(userId: string): Promise<string[]> {
  const entries = await db.studyProgress
    .where({ user_id: userId, entity_type: "tense" })
    .filter(sp => sp.study_completed_at !== null)
    .toArray();
  return entries.map(e => e.entity_id);
}
