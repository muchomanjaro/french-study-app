/**
 * @fileoverview Spaced Repetition Scheduling (SRS) engine.
 * Fixed-interval system: [0, 4, 72, 168, 336] hours.
 */

export const INTERVALS: readonly number[] = [0, 4, 72, 168, 336];

export const RETRY_INTERVAL_HOURS = 0.25; // 15 minutes

/** Calculate next due timestamp for a flashcard. */
export function nextDueAt(currentBox: number, isCorrect: boolean): Date {
  const now = Date.now();
  if (!isCorrect) {
    return new Date(now + RETRY_INTERVAL_HOURS * 60 * 60 * 1000);
  }
  const nextBoxVal = Math.min(currentBox + 1, INTERVALS.length - 1);
  return new Date(now + INTERVALS[nextBoxVal] * 60 * 60 * 1000);
}

/** Get the next SRS box after a correct answer. */
export function nextBox(currentBox: number): number {
  return Math.min(currentBox + 1, INTERVALS.length - 1);
}
