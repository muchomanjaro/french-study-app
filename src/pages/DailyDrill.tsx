import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDrill } from "../hooks/useDrill";
import verbsData from "../data/verbs.json";
import BlankInput from "../components/BlankInput";
import ProgressBar from "../components/ProgressBar";
import ScoreCard from "../components/ScoreCard";

const verbList = (verbsData as any).verbs || [];

interface DrillCard {
  id: string;
  prompt: string;
  correctAnswer: string;
  type: string;
  infinitive: string;
  tense: string;
  pronounIdx: number;
}

const PRONOUNS = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
const TENSES = ["present", "imparfait", "futur", "conditionnel_present"];

function generateCards(count: number): DrillCard[] {
  const cards: DrillCard[] = [];
  while (cards.length < count && verbList.length > 0) {
    const v = verbList[Math.floor(Math.random() * verbList.length)];
    const tense = TENSES[Math.floor(Math.random() * TENSES.length)];
    const conjugations = v.tenses[tense];
    if (!conjugations || conjugations.length === 0) continue;
    const pi = Math.floor(Math.random() * conjugations.length);
    cards.push({
      id: "drill-" + cards.length,
      prompt: "Conjugate "" + v.infinitive + "" (" + v.english + ") in " + tense + " for "" + PRONOUNS[pi] + """,
      correctAnswer: conjugations[pi],
      type: "verb",
      infinitive: v.infinitive,
      tense,
      pronounIdx: pi,
    });
  }
  return cards;
}

export default function DailyDrill() {
  const navigate = useNavigate();
  const { recordAttempt } = useDrill();
  const [cards, setCards] = useState<DrillCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCards(generateCards(5));
  }, []);

  const current = cards[currentIdx];
  const totalAnswered = Object.keys(results).length;

  const handleCheck = (id: string, correct: boolean) => {
    if (results[id] !== undefined) return;
    const newResults = { ...results, [id]: correct };
    setResults(newResults);
    if (current) {
      recordAttempt(
        { id: current.id, type: "verb" as const, ease: 2.5, interval: 0, dueDate: "", repetitions: 0, lastScore: 0 },
        correct ? 4 : 1
      );
    }
    if (currentIdx + 1 >= cards.length) {
      setCompleted(true);
    } else {
      setTimeout(() => setCurrentIdx((i: number) => i + 1), 1000);
    }
  };

  const restart = () => {
    setCards(generateCards(5));
    setCurrentIdx(0);
    setResults({});
    setCompleted(false);
  };

  if (cards.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <p className="text-gray-500">Loading drills...</p>
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
      <ProgressBar value={totalAnswered} max={cards.length} label="Drill Progress" className="mb-4" />
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-4">
        <p className="text-xs text-gray-400 mb-1 dark:text-gray-500">
          Card {currentIdx + 1} of {cards.length}
        </p>
        <p className="text-lg font-medium text-gray-900 dark:text-white mb-4">{current?.prompt}</p>
        <BlankInput
          id={current?.id || "q-" + currentIdx}
          answers={current ? [current.correctAnswer] : []}
          onCheck={handleCheck}
          disabled={results[current?.id || ""] !== undefined}
        />
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
