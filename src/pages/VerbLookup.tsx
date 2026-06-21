import React, { useState, useMemo } from "react";
import verbsData from "../data/verbs.json";
import VerbChip from "../components/VerbChip";

interface Verb {
  infinitive: string;
  english: string;
  auxiliary: string;
  past_participle: string;
  tenses: Record<string, string[]>;
  idioms: string[];
}

const TENSE_LABELS: Record<string, string> = {
  "présent": "Présent",
  "imparfait": "Imparfait",
  "passé_simple": "Passé simple",
  "futur": "Futur simple",
  "conditionnel_présent": "Conditionnel présent",
  "subjonctif_présent": "Subjonctif présent",
  "impératif": "Impératif",
  "passé_composé": "Passé composé",
  "plus_que_parfait": "Plus-que-parfait",
  "passé_antérieur": "Passé antérieur",
  "futur_antérieur": "Futur antérieur",
  "conditionnel_passé": "Conditionnel passé",
  "subjonctif_passé": "Subjonctif passé",
  "plus_que_parfait_subjonctif": "PQP subjonctif",
};

const PRONOUNS = ["je", "tu", "il/elle/on", "nous", "vous", "ils/elles"];

export default function VerbLookup() {
  const [search, setSearch] = useState("");
  const [selectedVerb, setSelectedVerb] = useState<Verb | null>(null);
  const [selectedTense, setSelectedTense] = useState("présent");

  const verbs: Verb[] = (verbsData as any).verbs || [];
  const filtered = useMemo(() => {
    if (!search.trim()) return verbs;
    const q = search.toLowerCase();
    return verbs.filter(
      (v) =>
        v.infinitive.toLowerCase().includes(q) ||
        v.english.toLowerCase().includes(q)
    );
  }, [search, verbs]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Conjugaison</h1>

      <input
        type="text"
        placeholder="Chercher un verbe..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 border rounded-lg mb-6 dark:bg-gray-800 dark:border-gray-700"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {filtered.map((v) => (
          <button
            key={v.infinitive}
            onClick={() => { setSelectedVerb(v); setSelectedTense("présent"); }}
            className={`p-3 rounded-lg text-left transition ${
              selectedVerb?.infinitive === v.infinitive
                ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-500"
                : "bg-white dark:bg-gray-800 border hover:border-blue-300"
            }`}
          >
            <div className="font-medium">{v.infinitive}</div>
            <div className="text-sm text-gray-500">{v.english}</div>
          </button>
        ))}
      </div>

      {selectedVerb && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold">{selectedVerb.infinitive}</h2>
            <VerbChip verb={selectedVerb.infinitive} />
            <span className="text-sm text-gray-500">
              aux. {selectedVerb.auxiliary} &middot; pp. {selectedVerb.past_participle}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {Object.keys(selectedVerb.tenses).map((tense) => (
              <button
                key={tense}
                onClick={() => setSelectedTense(tense)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedTense === tense
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"
                }`}
              >
                {TENSE_LABELS[tense] || tense.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm text-gray-500 w-24">Pronom</th>
                <th className="text-left py-2 text-sm text-gray-500">Conjugaison</th>
              </tr>
            </thead>
            <tbody>
              {PRONOUNS.map((pronoun, i) => (
                <tr key={pronoun} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 text-gray-500">{pronoun}</td>
                  <td className="py-2 font-mono">
                    {selectedVerb.tenses[selectedTense]?.[i] || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedVerb.idioms.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Expressions</h3>
              <div className="flex flex-wrap gap-2">
                {selectedVerb.idioms.map((idiom) => (
                  <span key={idiom} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                    {idiom}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
