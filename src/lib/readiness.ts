/**
 * @fileoverview BILAN readiness meter.
 * Calculates readiness score based on average across feeding chapters.
 */

export interface ChapterScore {
  chapterId: string;
  chapterName: string;
  averageScore: number;
  attempts: number;
}

export interface BilanReadiness {
  pct: number;
  weakChapters: ChapterScore[];
}

const DEFAULT_THRESHOLD = 70;

/**
 * Calculate BILAN readiness from chapter scores.
 * Returns overall pct and weakChapters (below threshold).
 */
export function bilanReadiness(
  chapterScores: ChapterScore[],
  threshold: number = DEFAULT_THRESHOLD
): BilanReadiness {
  if (chapterScores.length === 0) {
    return { pct: 0, weakChapters: [] };
  }
  const total = chapterScores.reduce((s, cs) => s + cs.averageScore, 0);
  const pct = Math.round(total / chapterScores.length);
  const weakChapters = chapterScores.filter(cs => cs.averageScore < threshold);
  return { pct, weakChapters };
}
