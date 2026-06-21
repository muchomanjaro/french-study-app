import { useState, useEffect, useCallback, useRef } from "react";
import Dexie, { type Table } from "dexie";
import { nextDueAt } from "../lib/srs";

export interface DrillCard {
  id?: number;
  cardId: string;
  front: string;
  back: string;
  srsBox: number;
  dueAt: string;
  chapterId: string;
}

export interface DrillResult {
  cardId: string;
  correct: boolean;
  attemptedAt: string;
}

export interface DrillState {
  dueCards: DrillCard[];
  currentCard: DrillCard | null;
  loading: boolean;
  error: string | null;
  remaining: number;
  nextCard: () => void;
  recordResult: (correct: boolean) => Promise<void>;
}

class DrillDatabase extends Dexie {
  cards!: Table<DrillCard, number>;
  constructor() {
    super("FrenchStudyDrills");
    this.version(1).stores({
      cards: "++id, cardId, dueAt, chapterId, srsBox",
    });
  }
}

let db: DrillDatabase;
function getDb(): DrillDatabase {
  if (!db) db = new DrillDatabase();
  return db;
}

export function useDrill(): DrillState {
  const [dueCards, setDueCards] = useState<DrillCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const database = getDb();
        const now = new Date().toISOString();
        const cards = await database.cards
          .where("dueAt")
          .belowOrEqual(now)
          .toArray();
        if (cancelled) return;
        cards.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
        setDueCards(cards);
        setCurrentIndex(0);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load drill cards";
        setError(msg);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const currentCard: DrillCard | null =
    dueCards.length > 0 && currentIndex < dueCards.length
      ? dueCards[currentIndex]
      : null;
  const remaining = Math.max(0, dueCards.length - currentIndex);

  const nextCard = useCallback(() => {
    setCurrentIndex((p) => p + 1);
  }, []);

  const recordResult = useCallback(async (correct: boolean): Promise<void> => {
    if (!currentCard || currentCard.id === undefined || processingRef.current) return;
    processingRef.current = true;
    try {
      const database = getDb();
      const newBox = correct ? Math.min(currentCard.srsBox + 1, 5) : 0;
      const dueDate = nextDueAt(correct ? currentCard.srsBox : 0, correct);
      const dueAt = dueDate.toISOString();
      await database.cards.update(currentCard.id, { srsBox: newBox, dueAt });
      setDueCards((prev) =>
        prev.map((c) => (c.id === currentCard.id ? { ...c, srsBox: newBox, dueAt } : c))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record result";
      setError(msg);
    } finally {
      processingRef.current = false;
    }
  }, [currentCard]);

  return { dueCards, currentCard, loading, error, remaining, nextCard, recordResult };
}
