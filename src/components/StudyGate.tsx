import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LocalStudyProgress } from "../db/local";
import { db } from "../db/local";

interface StudyGateProps {
  entityType: "chapter" | "tense";
  entityId: string;
  userId: string;
  /** Label for the "Skip" button, e.g. "Skip to Exercises" */
  skipLabel?: string;
  /** Where to go when user skips */
  skipTo: string;
  children: ReactNode;
}

/**
 * Soft gate — shows a warning banner if the user hasn't studied
 * the prerequisite material, but allows them to proceed.
 *
 * Design decision (§11.3): Soft gate, not blocking redirect.
 * "Skip to Exercises" button with confirmation dialog.
 */
export default function StudyGate({
  entityType,
  entityId,
  userId,
  skipLabel = "Skip to Exercises",
  skipTo,
  children,
}: StudyGateProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<LocalStudyProgress | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    db.studyProgress
      .where({ user_id: userId, entity_type: entityType, entity_id: entityId })
      .first()
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [userId, entityType, entityId]);

  if (progress === undefined) {
    // Loading
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isStudied = progress?.study_completed_at !== null && progress?.study_completed_at !== undefined;

  if (isStudied || dismissed) {
    return <>{children}</>;
  }

  // Not studied — show warning banner
  const lessonPath = entityType === "chapter"
    ? `/lesson/${entityId}`
    : `/verbs`;

  return (
    <div>
      {/* Warning Banner */}
      <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📚</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Study First
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              You haven't studied this {entityType === "chapter" ? "chapter" : "tense"} yet. 
              We recommend reviewing the lesson before attempting exercises.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => navigate(lessonPath)}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 transition-colors"
              >
                Go to Lesson
              </button>
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="px-3 py-1.5 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-300 dark:border-amber-600 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  {skipLabel}
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-amber-600 dark:text-amber-400">Are you sure?</span>
                  <button
                    onClick={() => {
                      setDismissed(true);
                      setShowConfirm(false);
                      // Also navigate to skipTo
                      navigate(skipTo);
                    }}
                    className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded hover:bg-red-600 transition-colors"
                  >
                    Yes, skip
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-2 py-1 text-amber-700 dark:text-amber-300 text-xs border border-amber-300 dark:border-amber-600 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Still render children so user sees what's behind */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    </div>
  );
}
