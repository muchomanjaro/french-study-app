# Hermes Runbook — Bug Fixes (QA 2026-06-22)
**Repo:** `~/projects/french-study-app`
**Branch:** `main`
**Commit when done:** `fix: QA bugfixes BUG-1 through BUG-6`

All fixes are surgical edits. Do them in order, run `npm run build` after all edits, verify no TS errors, then commit and push.

---

## BUG-5 — DailyDrill tense keys don't match verbs.json [CRITICAL]

**File:** `src/pages/DailyDrill.tsx`

Find:
```ts
const TENSES = ["present", "imparfait", "futur", "conditionnel_present"];
```

Replace with:
```ts
const TENSES = ["présent", "imparfait", "futur", "conditionnel_présent"];
```

**Why:** verbs.json uses accented keys. `"present"` and `"conditionnel_present"` never match, so ~50% of drill card generation attempts fail silently and those tenses never appear.

**Verify:** After fix, run:
```bash
node -e "
const v = require('./src/data/verbs.json').verbs[0];
const tenses = ['présent','imparfait','futur','conditionnel_présent'];
tenses.forEach(t => console.log(t, ':', v.tenses[t] ? 'OK' : 'MISSING'));
"
```
All four should print OK.

---

## BUG-3 — ExerciseSet completion never triggers on wrong answers [MEDIUM]

**File:** `src/pages/ExerciseSet.tsx` line 30

Find:
```ts
    if (correct) { setScore(s=>s+1); setSubmitted(s=>s+1); }
```

Replace with:
```ts
    if (correct) setScore(s=>s+1);
    if (!results[id]) setSubmitted(s=>s+1);
```

**Why:** `submitted` only advanced on correct answers. The completion condition `submitted >= totalBlanks` was unreachable if any blank was wrong. The new guard `!results[id]` prevents double-counting if the same blank is somehow checked twice.

---

## BUG-2 — Multi-blank sentences render duplicate BlankInputs [MEDIUM]

**File:** `src/pages/ExerciseSet.tsx` lines 78–100

The current render loop inserts a `<BlankInput>` for every `___` in a sentence, but each blank only owns one input. Sentences extracted from the textbook sometimes capture two blanks in one string (e.g. `"Je suis ___ anglais. ___ Vous êtes espagnol."`). Fix by trimming the sentence to only the clause surrounding the first `___`.

Find and replace the entire `blank.sentence ? (() => { ... })()` block:

```tsx
blank.sentence ? (() => {
  // Trim to first clause only — take text up to and including the first blank
  const firstOnly = blank.sentence.split('___').slice(0, 2).join('___').split('___');
  const before = firstOnly[0] || '';
  const after = firstOnly[1] || '';
  return (
    <p key={blank.id} className="text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 flex-wrap">
      <span className="flex-1 flex items-center gap-1 flex-wrap">
        {before && <span>{before}</span>}
        <BlankInput id={blank.id} answers={blank.answers} onCheck={handleCheck} disabled={!!results[blank.id]}/>
        {after && <span>{after}</span>}
      </span>
      <button
        type="button"
        onClick={() => speak(blank.sentence!.replace(/___/g, '…'))}
        className="text-lg hover:scale-110 transition-transform flex-shrink-0"
        title="Listen"
        aria-label="Listen to sentence"
      >🔊</button>
    </p>
  );
})()
```

**Why:** Each blank now renders exactly one input in a clean before/after layout. The 🔊 button is always visible. Multi-blank sentences are handled by each blank rendering its own trimmed clause.

---

## BUG-4 — "Try again" in DailyDrill re-enables input but Check is dead [LOW]

**File:** `src/pages/DailyDrill.tsx`

Find the `handleCheck` function:
```ts
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
```

Replace with:
```ts
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
    // Always advance after a delay — correct or not
    if (currentIdx + 1 >= cards.length) {
      setTimeout(() => setCompleted(true), correct ? 1000 : 2000);
    } else {
      setTimeout(() => setCurrentIdx((i: number) => i + 1), correct ? 1000 : 2000);
    }
  };
```

**Why:** Wrong answers now auto-advance after 2s (giving the user time to read "Expected: X"), instead of leaving them stuck with a re-enabled-but-broken Check button. The "Try again" in BlankInput will still render but auto-advance will move past the card before the user can act on it — acceptable UX for a drill context.

---

## BUG-1 — "Sign In" link on Home shown when authenticated [LOW]

**File:** `src/pages/Home.tsx`

Find:
```tsx
      <div className='mt-6 text-center'>
        <button onClick={() => navigate('/auth')} className='text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'>Sign In</button>
      </div>
```

Replace with:
```tsx
      <div className='mt-6 text-center'>
        <button onClick={async () => { const {supabase} = await import('../lib/supabase'); await supabase.auth.signOut(); navigate('/auth'); }} className='text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'>Sign Out</button>
      </div>
```

**Why:** Converts the confusing "Sign In" (shown while logged in) to a functional "Sign Out" button. Uses dynamic import to avoid adding a top-level supabase dependency to Home.

---

## BUG-6 — BlankInput startsWith match too permissive [LOW]

**File:** `src/components/BlankInput.tsx`

Find the inline normalizer and matching logic inside `handleSubmit`:
```ts
const c=answers.some(a=>{const n=(s:string)=>s.toLowerCase().trim().replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u').replace(/[ç]/g,'c').replace(/[^a-z0-9s'-à-ü]/g,'').trim();const v=n(value);const an=n(a);return v===an||an.startsWith(v)||v.startsWith(an);});
```

Replace with (uses the existing fuzzy.ts `isCorrect`):
```ts
const c=answers.some(a=>isCorrect(value.trim(),a));
```

And add the import at the top of the file (after the existing React import line):
```ts
import {isCorrect} from '../lib/fuzzy';
```

**Why:** Removes dangerous prefix matching (`"suis"` accepted for `"suis allé"`). Uses the same fuzzy engine already used by VerbQuiz — accent-insensitive, Levenshtein threshold by word length.

---

## Verification

After all edits:

```bash
cd ~/projects/french-study-app

# 1. TypeScript build — must be clean
npm run build 2>&1 | tail -20

# 2. Spot-check tense fix
node -e "
const v = require('./src/data/verbs.json').verbs[0];
['présent','imparfait','futur','conditionnel_présent'].forEach(t =>
  console.log(t, v.tenses[t] ? 'OK' : 'MISSING')
);
"

# 3. Commit
git add src/pages/DailyDrill.tsx src/pages/ExerciseSet.tsx src/components/BlankInput.tsx src/pages/Home.tsx
git commit -m "fix: QA bugfixes BUG-1 through BUG-6

BUG-5: DailyDrill tense keys — présent/conditionnel_présent (accented)
BUG-3: ExerciseSet submitted increments on wrong answers too
BUG-2: Multi-blank sentences render single BlankInput per blank
BUG-4: DailyDrill auto-advances after wrong answer (2s delay)
BUG-1: Home Sign In → Sign Out with supabase.auth.signOut()
BUG-6: BlankInput uses fuzzy.ts isCorrect instead of startsWith"

git push origin main
```

**Done signal:** `git push` succeeds and `npm run build` exits 0 with no TS errors.
