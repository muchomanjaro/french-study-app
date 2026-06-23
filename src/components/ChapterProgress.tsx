interface ChapterProgressProps {
  chapterId: string;
  chapterTitle: string;
  studyDone: boolean;
  exercisesDone: number;
  exercisesTotal: number;
  quizDone: boolean;
  onClick?: () => void;
}

/**
 * Renders a chapter row with progress indicators for the Home dashboard.
 */
export default function ChapterProgress({
  chapterId,
  chapterTitle,
  studyDone,
  exercisesDone,
  exercisesTotal,
  quizDone,
  onClick,
}: ChapterProgressProps) {
  const totalSteps = 3; // study, exercises, quiz
  const completedSteps = (studyDone ? 1 : 0) + (quizDone ? 1 : 0) + (exercisesDone >= exercisesTotal && exercisesTotal > 0 ? 1 : 0);
  const pct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{chapterId}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {chapterTitle}
            </span>
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <Step done={studyDone} label="Study" />
            <Step done={exercisesDone >= exercisesTotal && exercisesTotal > 0} label="Ex" />
            <Step done={quizDone} label="Quiz" />
          </div>
        </div>
        <div className="ml-3 flex flex-col items-end">
          <span className="text-lg font-bold text-gray-900 dark:text-white">{pct}%</span>
          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        done
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
      }`}
    >
      {done ? "✓" : "○"} {label}
    </span>
  );
}
