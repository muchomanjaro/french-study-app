import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import verbsData from "../data/verbs.json";
import { isCorrect } from "../lib/fuzzy";

interface Verb {
  infinitive: string;
  tenses: Record<string, string[]>;
}

const PRONOUNS = ["je", "tu", "il/elle/on", "nous", "vous", "ils/elles"];
const TENSE_LIST = ["présent", "imparfait", "passé_composé", "futur", "conditionnel_présent", "subjonctif_présent"];

const TENSE_LABELS: Record<string, string> = {
  "présent": "Présent",
  "imparfait": "Imparfait",
  "passé_composé": "Passé composé",
  "futur": "Futur simple",
  "conditionnel_présent": "Conditionnel présent",
  "subjonctif_présent": "Subjonctif présent",
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface QuizItem {
  verb: string;
  tense: string;
  pronoun: string;
  correctIndex: number;
}

function generateQuestion(verbs: Verb[], tenseFilter?: string): QuizItem {
  const verb = randomItem(verbs);
  const availableTenses = Object.keys(verb.tenses).filter(
    (t) => verb.tenses[t].length >= 6 && (!tenseFilter || t === tenseFilter)
  );
  const tense = availableTenses.length > 0
    ? randomItem(availableTenses)
    : (tenseFilter || randomItem(Object.keys(verb.tenses).filter(t => verb.tenses[t].length >= 6)));
  const pronounIdx = Math.floor(Math.random() * 6);
  return {
    verb: verb.infinitive,
    tense,
    pronoun: PRONOUNS[pronounIdx],
    correctIndex: pronounIdx,
  };
}

export default function VerbQuiz() {
  const { tense } = useParams<{ tense?: string }>();
  const navigate = useNavigate();
  const verbs: Verb[] = (verbsData as any).verbs || [];
  const [question, setQuestion] = useState(() => generateQuestion(verbs, tense));
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const correctAnswer = useMemo(() => {
    const v = verbs.find((v) => v.infinitive === question.verb);
    return v?.tenses[question.tense]?.[question.correctIndex] || "";
  }, [question, verbs]);

  const handleSubmit = useCallback(() => {
    const correct = isCorrect(input.trim(), correctAnswer);
    setResult(correct ? "correct" : "incorrect");
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }, [input, correctAnswer]);

  const nextQuestion = useCallback(() => {
    setQuestion(generateQuestion(verbs, tense));
    setInput("");
    setResult(null);
  }, [verbs, tense]);

  const tenseLabel = tense ? (TENSE_LABELS[tense] || tense.replace(/_/g, " ")) : null;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {tenseLabel && (
        <button onClick={() => navigate("/verbs")} className="text-sm text-blue-600 hover:underline mb-3 dark:text-blue-400">
          ← Back to Verbs
        </button>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Quiz Verbes{tenseLabel ? ` · ${tenseLabel}` : ""}
        </h1>
        <span className="text-sm text-gray-500">
          {score.correct}/{score.total} correct
        </span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border mb-4">
        <p className="text-lg mb-2">
          Conjuguez <strong>{question.verb}</strong> au{" "}
          <strong>{question.tense.replace(/_/g, " ")}</strong>
        </p>
        <p className="text-2xl font-bold mb-4">{question.pronoun}</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !result && handleSubmit()}
            disabled={!!result}
            placeholder="Écrivez la conjugaison..."
            className="flex-1 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          {!result && (
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Vérifier
            </button>
          )}
        </div>

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result === "correct" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
            <p className="font-bold">{result === "correct" ? "Correct !" : "Incorrect"}</p>
            {result === "incorrect" && (
              <p>
                Réponse : <strong className="font-mono">{correctAnswer}</strong>
              </p>
            )}
            <button
              onClick={nextQuestion}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
