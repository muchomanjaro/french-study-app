import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useStudyProgress } from "../hooks/useStudyProgress";
import exercisesData from "../data/exercises.json";

interface ExSet {
  id: string;
  page?: number;
  label?: string;
  type?: string;
  lesson_text?: string;
  items?: unknown[];
}

interface Chapter {
  id: string;
  title: string;
  exercise_sets: ExSet[];
}

const chapters = (exercisesData as any).chapters as Chapter[];

function cleanLessonText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/ (•|!\(|J>|\(«)/g, '\n\n$1')
    .trim();
}

export default function LessonPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [lessonText, setLessonText] = useState("");
  const [hasScrolled, setHasScrolled] = useState(false);
  const { chapterProgress, loading, markStudyComplete } = useStudyProgress(userId);

  // Get user ID
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Find chapter
  useEffect(() => {
    if (!chapterId) return;
    const ch = chapters.find((c) => c.id === chapterId);
    setChapter(ch ?? null);
    if (ch) {
      // Collect lesson_text from first exercise set that has it
      const text = ch.exercise_sets
        .filter((s) => s.lesson_text && s.lesson_text.length > 10)
        .map((s) => s.lesson_text)
        .join("\n\n");
      setLessonText(text || "Lesson content coming soon.");
    }
  }, [chapterId]);

  const isStudied = chapterProgress.get(chapterId ?? "")?.studyDone ?? false;
  const exercises = chapter?.exercise_sets.filter((s) => s.type === "exercise" && (s.items?.length ?? 0) > 0) ?? [];

  // Handle scroll tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setHasScrolled(true);
    }
  };

  const handleStudyComplete = async () => {
    if (!userId || !chapterId) return;
    await markStudyComplete("chapter", chapterId);
    // Navigate to first exercise
    if (exercises.length > 0) {
      navigate(`/exercise/${exercises[0].id}`);
    }
  };

  if (!chapterId || !chapter) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-gray-500">Chapter not found.</p>
        <button onClick={() => navigate("/")} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Back Home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <button onClick={() => navigate("/")} className="text-sm text-blue-600 hover:underline mb-3 dark:text-blue-400">
        ← Chapitres
      </button>
      <div className="mb-4">
        <span className="text-xs text-gray-400 uppercase font-mono">{chapter.id}</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{chapter.title}</h1>
      </div>

      {/* Lesson Content */}
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4 max-h-[50vh] overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="prose prose-sm dark:prose-invert text-gray-700 dark:text-gray-300 leading-relaxed">
          {lessonText ? (
            cleanLessonText(lessonText).split('\n\n').map((p, i) => (
              <p key={i} className="mb-3">{p}</p>
            ))
          ) : (
            <p className="text-gray-400 italic">Lesson content coming soon.</p>
          )}
        </div>
      </div>

      {/* Already studied state */}
      {isStudied && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✓ You've studied this lesson.
          </p>
          <button
            onClick={() => exercises.length > 0 && navigate(`/exercise/${exercises[0].id}`)}
            className="mt-2 w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Review → Exercises
          </button>
        </div>
      )}

      {/* Start Exercises CTA */}
      {!isStudied && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          {!hasScrolled ? (
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
              Scroll to the bottom to continue
            </p>
          ) : (
            <>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                Ready to practice? Complete the lesson to unlock exercises.
              </p>
              <button
                onClick={handleStudyComplete}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                ✓ I've read the lesson — Start Exercises
              </button>
            </>
          )}
        </div>
      )}

      {/* Exercise set list */}
      {exercises.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Exercises in this chapter</h3>
          <div className="grid gap-2">
            {exercises.map((set) => (
              <button
                key={set.id}
                onClick={() => navigate(`/exercise/${set.id}`)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-left hover:shadow-sm transition-shadow"
              >
                <span className="text-sm text-gray-900 dark:text-white">{set.label || `p. ${set.page}`}</span>
                <span className="text-xs text-gray-400 ml-2">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
