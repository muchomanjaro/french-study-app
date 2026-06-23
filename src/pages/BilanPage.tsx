import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { db } from "../db/local";
import { useStudyProgress } from "../hooks/useStudyProgress";
import exercisesData from "../data/exercises.json";
import answersData from "../data/answers.json";
import BlankInput from "../components/BlankInput";
import ProgressBar from "../components/ProgressBar";
import ScoreCard from "../components/ScoreCard";

interface Blank { id: string; answers: string[]; sentence?: string; }
interface ExItem { id: string; blanks: Blank[]; }
interface ExSet { id: string; page?: number; label?: string; type?: string; items: ExItem[]; }
interface Chapter { id: string; title: string; exercise_sets: ExSet[]; }
interface Bilan { id: string; type: string; chapter_refs: string[]; label?: string; }

const answers = answersData as Record<string, { items: ExItem[] }>;
const chapters = ((exercisesData as any).chapters as Chapter[]).map(ch => ({
  ...ch,
  exercise_sets: ch.exercise_sets.map(s => ({ ...s, items: answers[s.id]?.items || [] })),
}));
const bilans: Bilan[] = (exercisesData as any).bilans || [];

interface QuizItem { blankId: string; answers: string[]; sentence?: string; chapterId: string; }

export default function BilanPage() {
  const { bilanId } = useParams<{ bilanId: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [lockedChapters, setLockedChapters] = useState<string[]>([]);
  const { chapterProgress, markQuizComplete, loading } = useStudyProgress(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!bilanId) return;
    const b = bilans.find(bi => bi.id === bilanId);
    setBilan(b ?? null);
  }, [bilanId]);

  // Generate quiz items from referenced chapters
  useEffect(() => {
    if (!bilan || loading) return;
    const items: QuizItem[] = [];
    for (const chRef of bilan.chapter_refs) {
      const ch = chapters.find(c => c.id === chRef);
      if (!ch) continue;
      for (const set of ch.exercise_sets) {
        for (const item of set.items) {
          for (const blank of item.blanks) {
            items.push({
              blankId: `${set.id}_${blank.id}`,
              answers: blank.answers,
              sentence: blank.sentence,
              chapterId: chRef,
            });
          }
        }
      }
    }
    // Shuffle and limit to 20
    const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 20);
    setQuizItems(shuffled);

    // Check which chapters have uncompleted exercises
    const locked: string[] = [];
    for (const chRef of bilan.chapter_refs) {
      const cp = chapterProgress.get(chRef);
      const ch = chapters.find(c => c.id === chRef);
      const totalSets = ch?.exercise_sets.filter(s => s.items.length > 0).length ?? 0;
      const done = cp?.exercisesDone ?? 0;
      if (done < totalSets || totalSets === 0) {
        locked.push(chRef);
      }
    }
    setLockedChapters(locked);
  }, [bilan, loading, chapterProgress]);

  const totalBlanks = quizItems.length;

  const handleCheck = (id: string, correct: boolean) => {
    setResults(p => ({ ...p, [id]: correct }));
    if (correct) setScore(s => s + 1);
    if (!results[id]) setSubmitted(s => s + 1);
  };

  const handleComplete = async () => {
    setCompleted(true);
    // Mark quiz complete for all referenced chapters
    if (userId && bilan) {
      for (const chRef of bilan.chapter_refs) {
        await markQuizComplete("chapter", chRef);
      }
    }
  };

  if (!bilanId || !bilan) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-gray-500">Bilan not found.</p>
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

  // Locked state
  if (lockedChapters.length > 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <button onClick={() => navigate("/")} className="text-sm text-blue-600 hover:underline mb-4 dark:text-blue-400">
          ← Chapitres
        </button>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
          <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-3">
            🔒 {bilan.label || `Bilan ${bilan.id}`}
          </h2>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            Complétez d'abord :
          </p>
          <div className="space-y-2">
            {bilan.chapter_refs.map(chRef => {
              const ch = chapters.find(c => c.id === chRef);
              const isLocked = lockedChapters.includes(chRef);
              return (
                <div key={chRef} className="flex items-center gap-2 text-sm">
                  <span>{isLocked ? "🔴" : "✔"}</span>
                  <span className={isLocked ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-400 line-through"}>
                    {chRef} — {ch?.title || "Unknown"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Completed state
  if (completed) {
    const chapterScores: Record<string, { correct: number; total: number }> = {};
    for (const item of quizItems) {
      if (!chapterScores[item.chapterId]) chapterScores[item.chapterId] = { correct: 0, total: 0 };
      chapterScores[item.chapterId].total++;
      if (results[item.blankId]) chapterScores[item.chapterId].correct++;
    }

    return (
      <div className="p-4 max-w-lg mx-auto">
        <ScoreCard score={score} total={totalBlanks} label="Bilan Complete!" />
        <div className="mt-4 space-y-2">
          {Object.entries(chapterScores).map(([chId, sc]) => (
            <div key={chId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{chId}</span>
              <span className="text-sm font-medium">{sc.correct}/{sc.total}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate("/")}
          className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Back Home
        </button>
      </div>
    );
  }

  // Quiz mode
  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <button onClick={() => navigate("/")} className="text-sm text-blue-600 hover:underline mb-4 dark:text-blue-400">
        ← Chapitres
      </button>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {bilan.label || `Bilan ${bilan.id}`}
      </h1>
      <p className="text-xs text-gray-500 mb-4">
        Chapitres {bilan.chapter_refs.join(", ")}
      </p>
      <ProgressBar value={submitted} max={Math.max(totalBlanks, 1)} label="Progress" className="mb-4" />

      {quizItems.map(item => (
        <div key={item.blankId} className="mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          {item.sentence ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.sentence.split("___")[0]}</span>
              <BlankInput id={item.blankId} answers={item.answers} onCheck={handleCheck} disabled={!!results[item.blankId]} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.sentence.split("___").slice(1).join("___")}</span>
            </div>
          ) : (
            <BlankInput id={item.blankId} answers={item.answers} onCheck={handleCheck} disabled={!!results[item.blankId]} />
          )}
        </div>
      ))}

      {submitted >= totalBlanks && totalBlanks > 0 && (
        <button
          onClick={handleComplete}
          className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          See Results
        </button>
      )}
    </div>
  );
}
