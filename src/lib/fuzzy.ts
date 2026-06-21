/**
 * @fileoverview Fuzzy match engine for French Study App.
 * Accent-insensitive comparison using Levenshtein distance.
 */

/** Accent normalization map. */
const ACCENT_MAP: Record<string, string> = {
  "à": "a", "â": "a", "ä": "a",
  "é": "e", "è": "e", "ê": "e", "ë": "e",
  "î": "i", "ï": "i",
  "ô": "o", "ö": "o",
  "ù": "u", "û": "u", "ü": "u",
  "ç": "c",
  "À": "A", "Â": "A", "Ä": "A",
  "É": "E", "È": "E", "Ê": "E", "Ë": "E",
  "Î": "I", "Ï": "I",
  "Ô": "O", "Ö": "O",
  "Ù": "U", "Û": "U", "Ü": "U",
  "Ç": "C",
};

const ACCENT_REGEX = new RegExp("[" + Object.keys(ACCENT_MAP).join("") + "]", "g");

/**
 * Normalize a string by removing French accents.
 */
export function normalize(s: string): string {
  return s.replace(ACCENT_REGEX, (ch) => ACCENT_MAP[ch] ?? ch);
}

/**
 * Compute Levenshtein distance using two-row DP.
 */
export function levenshtein(a: string, b: string): number {
  const aLen = a.length, bLen = b.length;
  if (aLen < bLen) return levenshtein(b, a);
  let prevRow: number[] = new Array(bLen + 1);
  let currRow: number[] = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) prevRow[j] = j;
  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      currRow[j] = Math.min(prevRow[j]+1, currRow[j-1]+1, prevRow[j-1]+cost);
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[bLen];
}

/**
 * Check user answer against correct answer using threshold rules.
 * - Length <= 4: exact match required (dist === 0)
 * - Length 5-7: one edit allowed (dist <= 1)
 * - Length >= 8: two edits allowed (dist <= 2)
 */
export function isCorrect(userAnswer: string, correctAnswer: string): boolean {
  const u = normalize(userAnswer);
  const c = normalize(correctAnswer);
  const len = c.length;
  const dist = levenshtein(u, c);
  if (len <= 4) return dist === 0;
  if (len <= 7) return dist <= 1;
  return dist <= 2;
}
