import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSpeech } from "../hooks/useSpeech";
import { supabase } from "../lib/supabase";
import { db } from "../db/local";
import { useStudyProgress } from "../hooks/useStudyProgress";
import verbsData from "../data/verbs.json";
import exercisesData from "../data/exercises.json";
import answersData from "../data/answers.json";
import BlankInput from "../components/BlankInput";
import ProgressBar from "../components/ProgressBar";
import ScoreCard from "../components/ScoreCard";

interface Verb {
  infinitive: string;
  english: string;
  tenses: Record<string, string[]>;
}

interface Blank { id: string; answers: string[]; sentence?: string; }
interface ExItem { id: string; blanks: Blank[]; }

const verbList: Verb[] = (verbsData as any).verbs || [];
const chapters = ((exercisesData as any).chapters || []) as Array<{
  id: string; title: string; exercise_sets: Array<{ id: string; type?: string; items?: ExItem[] }>;
}>;
const answers = answersData as Record<string, { items: ExItem[] }>;

const PRONOUNS = ["je", "tu", "il/elle/on", "nous", "vous", "ils/elles"];

interface DrillCard {
  id: string;
  prompt: string;
  correctAnswer: string;
  type: "verb" | "fillin";
  infinitive?: string;
  tense?: string;
  pronounIdx?: number;
  sentence?: string;
  answers?: string[];
}

async function generateCards(userId: string, count: number): Promise<DrillCard[]> {
  const cards: DrillCard[] = [];

  // Get studied tenses
  const studiedTenses = await db.studyProgress
    .where({ user_id: userId, entity_type: "tense" })
    .filter(sp => sp.study_completed_at !== null)
    .toArray();
  const studiedTenseSet = new Set(studiedTenses.map(s => s.entity_id));

  // Get studied chapters
  const studiedChapters = await db.studyProgress
    .where({ user_id: userId, entity_type: "chapter" })
    .filter(sp => sp.study_completed_at !== null)
    .toArray();
  const studiedChapterIds = new Set(studiedChapters.map(s => s.entity_id));

  // Verb cards — only studied tenses
  const eligibleVerbs = verbList.filter(v =>
    Object.keys(v.tenses).some(t => studiedTenseSet.has(t))
  );

  // Fill-in-blank pool — from studied chapters
  const fillinItems: Array<{ chapterId: string; sentence: string; blankId: string; answers: string[] }> = [];
  for (const ch of chapters) {
    if (!studiedChapterIds.has(ch.id)) continue;
    for (const set of ch.exercise_sets) {
      if (set.type === "bilan") continue;
      const setAnswers = answers[set.id];
      if (!setAnswers?.items) continue;
      for (const item of setAnswers.items) {
        for (const blank of item.blanks) {
          if (blank.sentence) {
            fillinItems.push({
              chapterId: ch.id,
              sentence: blank.sentence,
              blankId: `${set.id}_${blank.id}`,
              answers: blank.answers,
            });
          }
        }
      }
    }
  }

  // Mix verb + fillin cards
  let verbIdx = 0;
  let fillinIdx = 0;
  for (let i = 0; i < count; i++) {
    // Alternate verb and fill-in, but only if both pools exist
    const useVerb = (i % 2 === 0 && eligibleVerbs.length > 0) || fillinItems.length === 0;

    if (useVerb && eligibleVerbs.length > 0) {
      const v = eligibleVerbs[Math.floor(Math.random() * eligibleVerbs.length)];
      const availableTenses = Object.keys(v.tenses).filter(t => studiedTenseSet.has(t) && v.tenses[t].length >= 6);
      if (availableTenses.length === 0) { i--; continue; }
      const tense = availableTenses[Math.floor(Math.random() * availableTenses.length)];
      const pi = Math.floor(Math.random() * Math.min(6, v.tenses[tense].length));
      cards.push({
        id: `drill-v-${i}`,
        prompt: `Conjugate '${v.infinitive}' (${v.english}) in ${tense.replace(/_/g, ' ')} for '${PRONOUNS[pi]}'`,
        correctAnswer: v.tenses[tense][pi],
        type: "verb",
        infinitive: v.infinitive,
        tense,
        pronounIdx: pi,
      });
    } else if (fillinItems.length > 0) {
      const item = fillinItems[Math.floor(Math.random() * fillinItems.length)];
      cards.push({
        id: `drill-f-${i}`,
        prompt: "Complete the sentence",
        correctAnswer: item.answers[0] || "",
        type: "fillin",
        sentence: item.sentence,
        answers: item.answers,
      });
    } else {
      break; // No more content
    }
  }

  return cards;
}

export default function DailyDrill() {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const [userId, setUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<DrillCard[] | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const { chapterProgress, tenseProgress } = useStudyProgress(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    generateCards(userId, 7).then(setCards);
  }, [userId, chapterProgress, tenseProgress]);

  const current = cards?.[currentIdx];
  const totalAnswered = Object.keys(results).length;

  const nextCard = () => {
    if (!cards) return;
    if (currentIdx + 1 >= cards.length) {
      setCompleted(true);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const handleCheck = (id: string, correct: boolean) => {
    if (results[id] !== undefined) return;
    const newResults = { ...results, [id]: correct };
    setResults(newResults);
    setTimeout(() => nextCard(), correct ? 1500 : 2500);
  };

  const restart = () => {
    if (userId) generateCards(userId, 7).then(setCards);
    setCurrentIdx(0);
    setResults({});
    setCompleted(false);
  };

  // No-studied-material state
  if (cards !== null && cards.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Daily Drill</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
            Aucun contenu étudié
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            Study some chapters or verb tenses first to unlock drills.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Go Study →
          </button>
        </div>
      </div>
    );
  }

  if (!cards) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
      </div>
    );
  }

  if (completed) {
    const correct = Object.values(results).filter(Boolean).length;
    return (
      <div className="p-4 max-w-lg mx-auto">
        <ScoreCard score={correct} total={cards.length} label="Drill Complete!" />
        <p className="text-center text-sm text-gray-500 mt-4 mb-6 dark:text-gray-400">
          Great effort! Keep practicing to improve.
        </p>
        <button
          onClick={restart}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm mb-3"
        >
          New Drill
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 text-sm"
        >
          Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={() => navigate("/")} className="text-sm text-blue-600 hover:underline mb-3 dark:text-blue-400">
        ← Back
      </button>
      <ProgressBar value={totalAnswered} max={cards.length} label="Drill Progress" className="mb-4" />

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-4">
        <p className="text-xs text-gray-400 mb-1 dark:text-gray-500">
          Card {currentIdx + 1} of {cards.length}
          {current?.type === "fillin" && " · Fill-in"} 
          {current?.type === "verb" && " · Verb"}
        </p>

        {current?.type === "verb" && (
          <>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex-1">{current.prompt}</span>
              <button
                type="button"
                onClick={() => speak(current.prompt || "")}
                className="text-lg hover:scale-110 transition-transform flex-shrink-0"
                title="Listen"
                aria-label="Listen to prompt"
              >🔊</button>
            </p>
            <BlankInput
              id={current.id}
              answers={[current.correctAnswer]}
              onCheck={handleCheck}
              disabled={results[current.id] !== undefined}
            />
          </>
        )}

        {current?.type === "fillin" && current.sentence && (
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <span className="flex-1">{current.sentence.split("___")[0]}</span>
              <BlankInput
                id={current.id}
                answers={current.answers || [current.correctAnswer]}
                onCheck={handleCheck}
                disabled={results[current.id] !== undefined}
              />
              <span>{current.sentence.split("___").slice(1).join("___")}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-center">
        {cards.map((_, i) => (
          <div
            key={i}
            className={
              "w-3 h-3 rounded-full " +
              (results[cards[i]?.id || ""] !== undefined
                ? "bg-blue-500"
                : i === currentIdx
                  ? "bg-blue-300"
                  : "bg-gray-300 dark:bg-gray-600")
            }
          />
        ))}
      </div>
    </div>
  );
}
