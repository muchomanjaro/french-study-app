import { useEffect, useState } from "react";
import { db } from "../db/local";
import type { ChapterProgressState, TenseProgressState, StudyState } from "../lib/gates";

interface UseStudyProgressResult extends StudyState {
  refresh: () => Promise<void>;
  markStudyComplete: (type: "chapter" | "tense", id: string) => Promise<void>;
  markExerciseComplete: (setId: string, scorePct: number) => Promise<void>;
  markQuizComplete: (type: "chapter" | "tense", id: string) => Promise<void>;
}

export function useStudyProgress(userId: string | null): UseStudyProgressResult {
  const [chapterProgress, setChapterProgress] = useState<Map<string, ChapterProgressState>>(new Map());
  const [tenseProgress, setTenseProgress] = useState<Map<string, TenseProgressState>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadProgress = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const studyEntries = await db.studyProgress
        .where("user_id")
        .equals(userId)
        .toArray();

      const exerciseEntries = await db.exerciseProgress
        .where("user_id")
        .equals(userId)
        .toArray();

      const chapters = new Map<string, ChapterProgressState>();
      const tenses = new Map<string, TenseProgressState>();

      for (const entry of studyEntries) {
        if (entry.entity_type === "chapter") {
          const exDone = exerciseEntries.filter(
            e => e.exercise_set_id.startsWith(entry.entity_id + "_")
          ).filter(e => e.completed_at !== null).length;
          chapters.set(entry.entity_id, {
            studyDone: entry.study_completed_at !== null,
            exercisesDone: exDone,
            exercisesTotal: 0, // Filled by page component
            quizDone: entry.quiz_completed_at !== null,
          });
        } else {
          tenses.set(entry.entity_id, {
            studyDone: entry.study_completed_at !== null,
            quizDone: entry.quiz_completed_at !== null,
          });
        }
      }

      setChapterProgress(chapters);
      setTenseProgress(tenses);
    } catch (e) {
      console.error("[useStudyProgress] load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProgress(); }, [userId]);

  const overallPct = (() => {
    let total = 0, done = 0;
    for (const [, cp] of chapterProgress) {
      total++;
      if (cp.studyDone) done++;
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  })();

  const markStudyComplete = async (type: "chapter" | "tense", id: string) => {
    const now = new Date().toISOString();
    const existing = await db.studyProgress
      .where({ user_id: userId!, entity_type: type, entity_id: id })
      .first();
    if (existing) {
      await db.studyProgress.update(existing.id, {
        study_completed_at: now,
        updated_at: now,
      });
    } else {
      await db.studyProgress.put({
        id: crypto.randomUUID(),
        user_id: userId!,
        entity_type: type,
        entity_id: id,
        study_completed_at: now,
        exercises_completed_at: null,
        quiz_completed_at: null,
        created_at: now,
        updated_at: now,
      });
    }
    await loadProgress();
  };

  const markExerciseComplete = async (setId: string, scorePct: number) => {
    const now = new Date().toISOString();
    const existing = await db.exerciseProgress
      .where({ user_id: userId!, exercise_set_id: setId })
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
        user_id: userId!,
        exercise_set_id: setId,
        score_pct: scorePct,
        completed_at: now,
        created_at: now,
        updated_at: now,
      });
    }
    await loadProgress();
  };

  const markQuizComplete = async (type: "chapter" | "tense", id: string) => {
    const now = new Date().toISOString();
    const existing = await db.studyProgress
      .where({ user_id: userId!, entity_type: type, entity_id: id })
      .first();
    if (existing) {
      await db.studyProgress.update(existing.id, {
        quiz_completed_at: now,
        updated_at: now,
      });
    } else {
      await db.studyProgress.put({
        id: crypto.randomUUID(),
        user_id: userId!,
        entity_type: type,
        entity_id: id,
        study_completed_at: null,
        exercises_completed_at: null,
        quiz_completed_at: now,
        created_at: now,
        updated_at: now,
      });
    }
    await loadProgress();
  };

  return {
    chapterProgress,
    tenseProgress,
    loading,
    overallPct,
    refresh: loadProgress,
    markStudyComplete,
    markExerciseComplete,
    markQuizComplete,
  };
}
