import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useStudyProgress } from "../hooks/useStudyProgress";
import { useDrill } from "../hooks/useDrill";
import exercisesData from "../data/exercises.json";
import ProgressBar from "../components/ProgressBar";
import ChapterProgress from "../components/ChapterProgress";
import SyncIndicator from "../components/SyncIndicator";

interface ExSet { id: string; page?: number; type?: string; items?: unknown[]; }
interface Chapter { id: string; title: string; exercise_sets: ExSet[]; }

const chapters = (exercisesData as any).chapters as Chapter[];

export default function Home() {
  const navigate = useNavigate();
  const { dueCards } = useDrill();
  const [userId, setUserId] = useState<string | null>(null);
  const { chapterProgress, tenseProgress, overallPct, loading } = useStudyProgress(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Build chapter list with exercise counts from data
  const chapterList = chapters.map(ch => {
    const cp = chapterProgress.get(ch.id);
    const totalSets = ch.exercise_sets.filter(s => s.type === "exercise" && (s.items?.length ?? 0) > 0).length;
    return {
      id: ch.id,
      title: ch.title,
      studyDone: cp?.studyDone ?? false,
      exercisesDone: cp?.exercisesDone ?? 0,
      exercisesTotal: totalSets,
      quizDone: cp?.quizDone ?? false,
    };
  });

  // Find last studied chapter
  const lastStudied = [...chapterProgress.entries()]
    .filter(([, cp]) => cp.studyDone)
    .sort()
    .pop();
  const lastChapter = lastStudied
    ? chapters.find(c => c.id === lastStudied[0])
    : null;

  const quickActions = [
    { label: "Study", desc: "Grammar Lessons", path: "/lesson/ch01", icon: "📖", color: "bg-blue-500" },
    { label: "Verbs", desc: "Conjugation", path: "/verbs", icon: "🔍", color: "bg-purple-500" },
    { label: "Practice", desc: "Exercises", path: "/exercise/ch01_p009", icon: "✏️", color: "bg-green-500" },
    { label: "Quiz", desc: "Verb Quiz", path: "/verbs/quiz", icon: "🎯", color: "bg-amber-500" },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bienvenue! 👋</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Keep practicing</p>
        </div>
        <SyncIndicator />
      </header>

      {/* Study Progress Ring */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Study Progress</p>
            <p className="text-xs text-gray-500">{chapterList.filter(c => c.studyDone).length}/{chapterList.length} chapters studied</p>
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{overallPct}%</div>
        </div>
        <ProgressBar value={overallPct} max={100} label="" className="mt-2" />
      </div>

      {/* Continue Studying */}
      {lastChapter && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Continue Studying</p>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{lastChapter.title}</p>
          <button
            onClick={() => navigate(`/lesson/${lastChapter.id}`)}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
          >
            Resume →
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {quickActions.map(a => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className={"w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-2 " + a.color}>
              {a.icon}
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{a.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{a.desc}</p>
          </button>
        ))}
      </div>

      {/* Due Drills */}
      {dueCards.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Daily Drill</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">{dueCards.length} item{dueCards.length > 1 ? "s" : ""} due</p>
            </div>
            <button onClick={() => navigate("/drill")} className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600">
              Review
            </button>
          </div>
        </div>
      )}

      {/* Chapter Progress List */}
      <h2 className="text-sm font-medium text-gray-500 mb-2 mt-4">Chapitres</h2>
      <div className="grid gap-2">
        {chapterList.map(ch => (
          <ChapterProgress
            key={ch.id}
            chapterId={ch.id}
            chapterTitle={ch.title}
            studyDone={ch.studyDone}
            exercisesDone={ch.exercisesDone}
            exercisesTotal={ch.exercisesTotal}
            quizDone={ch.quizDone}
            onClick={() => navigate(`/lesson/${ch.id}`)}
          />
        ))}
      </div>

      {/* Sign Out */}
      <div className="mt-6 text-center">
        <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Sign Out
        </button>
      </div>
    </div>
  );
}
