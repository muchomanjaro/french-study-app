# Design Proposal: Study-Before-Test Pedagogical Architecture

**Date:** 2026-06-23
**Repo:** ~/projects/french-study-app
**Author:** Swarm design team (Cincinnatus)
**Status:** Design review — do NOT push

---

## 1. Executive Summary

This proposal transforms the French Study App from a quiz-first experience into a pedagogically sound **Study → Practice → Quiz → Review** pipeline. The core change: no exercise, quiz, or drill appears until the user has first seen the relevant study material. Progress tracking across all four stages is persisted offline-first via Dexie and synced to Supabase.

---

## 2. Architecture Overview

```
                    ┌────────────┐
                    │    HOME    │  Study Progress Dashboard
                    └─────┬──────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  CHAPTER   │  │   VERB     │  │   DAILY    │
   │   FLOW     │  │   FLOW     │  │   DRILL    │
   └────────────┘  └────────────┘  └────────────┘
          │               │               │
    ┌─────┴─────┐   ┌─────┴─────┐   ONLY studied
    ▼     ▼     ▼   ▼     ▼     ▼   material
  Lesson→Exerc→Bilan  Lookup→Quiz
    │     │     │     │     │
    └──┬──┘     │     └──┬──┘
       ▼        │        ▼
   study_  exercises_  study_
   done    done        done
       │        │        │
       └────────┼────────┘
                ▼
        SRS Drill Queue
        (gated by study+exercise completion)
```

### New Routes

| Route | Page | Description |
|-------|------|-------------|
| `/lesson/:chapterId` | `LessonPage` | Study grammar rule + examples before exercises |
| `/lesson/:chapterId/:setId` | `ExerciseSet` (modified) | Exercise after lesson seen; gated |
| `/bilan/:bilanId` | `BilanPage` | Chapter-review quiz after all exercises complete |
| `/verbs` | `VerbLookup` (modified) | Browse verbs + "Quiz Me on This Tense" button |
| `/verbs/quiz/:tense?` | `VerbQuiz` (modified) | Accept optional `tense` param for filtered mode |
| `/drill` | `DailyDrill` (modified) | SRS — only studied material |

### Existing Routes Preserved

| Route | Action |
|-------|--------|
| `/auth` | Unchanged |
| `/` | Home — redesigned dashboard |
| `/exercise/:setId` | Redirects to `/lesson/:chapterId` first if not studied |

---

## 3. Data Layer

### 3.1 Dexie Schema Migration (v1 → v2)

**New tables:**

```typescript
// Tracks study completion per chapter
export interface LocalStudyProgress {
  id: string;             // uuid
  user_id: string;
  entity_type: "chapter" | "tense";
  entity_id: string;      // e.g., "ch01", "présent"
  study_completed_at: string | null;   // ISO timestamp
  exercises_completed_at: string | null;
  quiz_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Tracks exercise set completion per set
export interface LocalExerciseProgress {
  id: string;             // uuid
  user_id: string;
  exercise_set_id: string;
  score_pct: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
```

**Modified tables:**

`LocalProgress` — add field:
```typescript
study_completed: boolean;   // default false
```

### 3.2 Supabase Schema Migration (002)

```sql
-- Study progress tracking
CREATE TABLE IF NOT EXISTS public.study_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('chapter', 'tense')),
    entity_id       TEXT NOT NULL,
    study_completed_at      TIMESTAMPTZ,
    exercises_completed_at  TIMESTAMPTZ,
    quiz_completed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entity_type, entity_id)
);

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own study progress"
    ON public.study_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own study progress"
    ON public.study_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own study progress"
    ON public.study_progress FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Exercise-level progress
CREATE TABLE IF NOT EXISTS public.exercise_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_set_id TEXT NOT NULL,
    score_pct       NUMERIC(5,2) CHECK (score_pct >= 0 AND score_pct <= 100),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, exercise_set_id)
);

ALTER TABLE public.exercise_progress ENABLE ROW LEVEL SECURITY;
-- (RLS policies mirror study_progress pattern)

-- Indexes
CREATE INDEX idx_study_progress_user ON public.study_progress(user_id, entity_type);
CREATE INDEX idx_exercise_progress_user ON public.exercise_progress(user_id, exercise_set_id);
```

### 3.3 Sync Config Update

`src/db/sync.ts` — add to `SYNC_TABLES`:
```typescript
{ local: "studyProgress", remote: "study_progress", primaryKey: "id" },
{ local: "exerciseProgress", remote: "exercise_progress", primaryKey: "id" },
```

---

## 4. Component Specifications

### 4.1 LessonPage (`src/pages/LessonPage.tsx`)

**Route:** `/lesson/:chapterId`

**Purpose:** Display grammar lesson text before the user can access exercises for that chapter.

**States:**
- **Loading:** Skeleton while fetching lesson data from `exercises.json`
- **Lesson display:** Chapter title, lesson_text content (markdown rendering), grammar rules, examples
- **Study complete:** "Start Exercises" CTA button after user scrolls/reads
- **Already studied:** "Review → Exercises" button if previously completed

**Data flow:**
1. Extract `chapterId` from route params
2. Find chapter in `exercises.json.chapters[]`
3. Collect `lesson_text` from all exercise_sets in that chapter
4. Check `studyProgress` Dexie table for `study_completed_at`
5. On "Start Exercises" click: 
   - Mark `study_completed_at` in Dexie `studyProgress`
   - Navigate to first exercise set: `/lesson/:chapterId/:setId`

**UI structure:**
```
┌────────────────────────────────┐
│ ← Chapitres                    │
│                                │
│ CHAPITRE 3                     │
│ LA NÉGATION et L'INTERROGATION │
│                                │
│ [Lesson text content —         │
│  grammar rules, explanations,  │
│  examples with translations]   │
│                                │
│ ┌──────────────────────────┐   │
│ │  ✔ J'ai lu la leçon     │   │
│ │  Commencer les exercices│   │
│ └──────────────────────────┘   │
└────────────────────────────────┘
```

**Components used:** None new needed; uses Tailwind prose classes for lesson content.

**Accessibility:** Semantic headings, skip-to-exercises link, screen-reader-friendly.

---

### 4.2 ExerciseSet (Modified — `src/pages/ExerciseSet.tsx`)

**Changes:**
1. **Gate:** When a user navigates to `/exercise/ch01_1`, check if study is complete. If not, redirect to `/lesson/ch01`.
2. **Progress tracking:** On exercise completion, write to `exerciseProgress` table in Dexie.
3. **Set selector:** Show lock icon (🔒) for sets where prerequisite sets aren't complete.
4. **Post-exercise:** After completing all sets in a chapter, show "Take Bilan" CTA linking to `/bilan/:bilanId`.

**Gate logic (pseudocode):**
```typescript
useEffect(() => {
  if (!setId) return;
  const chapterId = setId.split('_')[0];
  const study = await db.studyProgress
    .where({ entity_type: 'chapter', entity_id: chapterId })
    .first();
  if (!study?.study_completed_at) {
    navigate(`/lesson/${chapterId}`, { replace: true });
  }
}, [setId]);
```

**Locked set display:**
```
┌────────────────────────────┐
│ 🔒 Exercices p. 13         │
│    Complétez p. 9 d'abord  │
└────────────────────────────┘
```

---

### 4.3 VerbLookup (Modified — `src/pages/VerbLookup.tsx`)

**Changes:**
1. **"Quiz Me on This Tense" button** — Appears in the tense conjugation table when a verb+tense is selected.
2. **Navigation:** Routes to `/verbs/quiz/:tense` with the selected tense as param.
3. **Study tracking:** When user views a tense table, optionally mark `study_completed` for that tense entity.

**New button (added to tense table section):**
```
┌──────────────────────────────┐
│ Pronom    Conjugaison        │
│ je        vais               │
│ tu        vas                │
│ ...                          │
├──────────────────────────────┤
│ 🎯 Quiz Me on Présent →      │  ← NEW
└──────────────────────────────┘
```

**Implementation:**
```tsx
<button
  onClick={() => navigate(`/verbs/quiz/${selectedTense}`)}
  className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg"
>
  🎯 Quiz Me on {TENSE_LABELS[selectedTense]}
</button>
```

### 4.4 VerbQuiz (Modified — `src/pages/VerbQuiz.tsx`)

**Changes:**
1. **Accept optional `tense` URL param:** `/verbs/quiz/:tense?`
2. **Filtered mode:** When `tense` param present, only generate questions for that tense (all 12 verbs). Skip the random tense selection.
3. **Study tracking:** On quiz session complete, write to `studyProgress` for the tense entity.
4. **Score persistence:** Write quiz results to Dexie `verbHistory` table (already exists).

**Implementation:**
```typescript
const { tense } = useParams<{ tense?: string }>();

function generateQuestion(verbs: Verb[]): QuizItem {
  const verb = randomItem(verbs);
  const targetedTense = tense || randomItem(TENSE_LIST);
  // ... rest same
}
```

**UI change when tense-filtered:**
```
┌────────────────────────────────┐
│ ← Back to Verbs   Quiz Présent │  ← Shows tense when filtered
│             3/10 correct       │
│                                │
│ Conjuguez aller au présent     │
│            je                  │
│ [          ] [Vérifier]        │
└────────────────────────────────┘
```

---

### 4.5 BilanPage (NEW — `src/pages/BilanPage.tsx`)

**Route:** `/bilan/:bilanId`

**Purpose:** Chapter review test that quizzes everything from the chapters feeding into this bilan.

**Data source:** `exercises.json` — bilan entries have `type: "bilan"` with `chapter_refs` array.

**Gate:** Only accessible when all exercises in `chapter_refs` chapters are completed.

**States:**
- **Loading:** Fetching bilan data and checking completion
- **Gated (locked):** Shows which chapters still need exercises completed
- **Quiz mode:** Random selection of items from all referenced chapters
- **Results:** Score breakdown by chapter

**Quiz logic:**
1. For each `chapter_ref`, collect all `exercise_set` items
2. Shuffle and select up to 20 items
3. Present as fill-in-blanks (reuse `BlankInput` component)
4. Score and record in Dexie `studyProgress.quiz_completed_at`

**UI structure:**
```
┌────────────────────────────────┐
│ ← Chapitres                    │
│                                │
│ BILAN N° 2                     │
│ Chapitres 4–7                  │
│                                │
│ ┌──────────────────────────┐   │
│ │ Item 1: Complétez...     │   │
│ │ [... ___ ...] [Check]    │   │
│ └──────────────────────────┘   │
│                                │
│ Progress: ████████░░ 8/20      │
└────────────────────────────────┘
```

**Locked state:**
```
┌────────────────────────────────┐
│ 🔒 BILAN N° 2                  │
│                                │
│ Complétez d'abord :           │
│ ✔ ch04 — L'article            │
│ 🔴 ch05 — Le nom              │
│ ✔ ch06 — Le genre             │
│ 🔴 ch07 — Les noms de parenté │
└────────────────────────────────┘
```

---

### 4.6 DailyDrill (Modified — `src/pages/DailyDrill.tsx`)

**Changes:**

1. **Study gate:** Only generate cards for material the user has studied.
   - For verb cards: check `studyProgress` for `entity_type: 'tense'` with matching tense
   - For vocabulary/grammar cards: check `studyProgress` for `entity_type: 'chapter'`
   
2. **Card source filtering:**
```typescript
async function generateCards(count: number): Promise<DrillCard[]> {
  // Get user's studied tenses
  const studied = await db.studyProgress
    .where({ entity_type: 'tense' })
    .filter(sp => sp.study_completed_at !== null)
    .toArray();
  
  const studiedTenses = new Set(studied.map(s => s.entity_id));
  
  // Only pick verbs/tenses the user has studied
  const eligibleVerbs = verbList.filter(v => 
    Object.keys(v.tenses).some(t => studiedTenses.has(t))
  );
  
  // ... generate cards only from eligible pool
}
```

3. **No-studied-material state:**
```
┌────────────────────────────────┐
│ Daily Drill                    │
│                                │
│ 📚 Aucun contenu étudié        │
│                                │
│ Study some chapters or verb    │
│ tenses first to unlock drills. │
│                                │
│ [Go Study →]                   │
└────────────────────────────────┘
```

4. **Mixed card types:** Cards can be verbs OR fill-in-blank from studied chapters. The `type` field on each card controls rendering (verb conjugation vs sentence completion).

---

### 4.7 Home Dashboard (Modified — `src/pages/Home.tsx`)

**Changes:** Reorganize into a study-progress-oriented dashboard.

**New sections:**

1. **Study Progress Ring** — Overall completion percentage across all chapters
2. **Continue Studying** — Quick-resume the chapter the user was last studying
3. **Quick Actions** — Reorganized into study-guided flow:
   ```
   ┌──────────────┐  ┌──────────────┐
   │ 📖 Study     │  │ 🔍 Verbs     │
   │ Grammar      │  │ Conjugation  │
   └──────────────┘  └──────────────┘
   ┌──────────────┐  ┌──────────────┐
   │ ✏️ Practice  │  │ 🎯 Quiz      │
   │ Exercises    │  │ Verb Quiz    │
   └──────────────┘  └──────────────┘
   ┌──────────────────────────────┐
   │ 📝 Daily Drill  (3 due)  →   │
   └──────────────────────────────┘
   ```

4. **Chapter list with progress indicators:**
```
Chapitres
┌─────────────────────────────────┐
│ ch01  ÊTRE            ████░░ 67%│
│ ch02  L'ADJECTIF      ░░░░░░  0%│
│ ch03  LA NÉGATION     ██░░░░ 33%│
└─────────────────────────────────┘
```

**Data sources:**
- Overall score: aggregate from `exerciseProgress`
- Study progress: `studyProgress` for `entity_type: 'chapter'`
- Due drills: SRS queue (existing `useDrill` hook)
- Chapter progress: count of completed exercise sets per chapter

**Implementation approach:** The existing Home.tsx uses an inline `ProgressDB` class. We'll refactor to use the unified `FrenchStudyDB` from `src/db/local.ts` and add new query methods.

---

## 5. Progress Tracking Engine

### 5.1 New Hook: `useStudyProgress`

```typescript
// src/hooks/useStudyProgress.ts
export interface StudyState {
  chapterProgress: Map<string, {
    studyDone: boolean;
    exercisesDone: number;    // count complete
    exercisesTotal: number;   // total sets in chapter
    quizDone: boolean;
  }>;
  tenseProgress: Map<string, {
    studyDone: boolean;
    quizDone: boolean;
  }>;
  loading: boolean;
  markStudyComplete: (type: 'chapter'|'tense', id: string) => Promise<void>;
  markExerciseComplete: (setId: string, scorePct: number) => Promise<void>;
  markQuizComplete: (type: 'chapter'|'tense', id: string) => Promise<void>;
}
```

### 5.2 Gate Middleware

A `StudyGate` component wraps exercise/quiz routes:

```typescript
// src/components/StudyGate.tsx
function StudyGate({ 
  entityType, entityId, children 
}: { 
  entityType: 'chapter' | 'tense'; 
  entityId: string;
  children: React.ReactNode;
}) {
  const { progress, loading } = useStudyProgress();
  const navigate = useNavigate();
  
  if (loading) return <Skeleton />;
  
  const isStudied = entityType === 'chapter'
    ? progress.chapterProgress.get(entityId)?.studyDone
    : progress.tenseProgress.get(entityId)?.studyDone;
  
  if (!isStudied) {
    const redirectPath = entityType === 'chapter' 
      ? `/lesson/${entityId}` 
      : `/verbs/${entityId}`;
    navigate(redirectPath, { replace: true });
    return null;
  }
  
  return <>{children}</>;
}
```

---

## 6. File Structure Changes

```
src/
├── pages/
│   ├── LessonPage.tsx          ← NEW
│   ├── BilanPage.tsx           ← NEW
│   ├── Home.tsx                ← REWRITTEN (dashboard)
│   ├── ExerciseSet.tsx         ← MODIFIED (gate + progress)
│   ├── VerbLookup.tsx          ← MODIFIED (quiz button)
│   ├── VerbQuiz.tsx            ← MODIFIED (tense filter)
│   ├── DailyDrill.tsx          ← MODIFIED (study gate)
│   ├── Auth.tsx                ← UNCHANGED
│   └── HomePage.tsx            ← UNCHANGED (stale, eventually remove)
├── components/
│   ├── StudyGate.tsx           ← NEW
│   ├── ChapterProgress.tsx     ← NEW
│   ├── (all existing)          ← UNCHANGED
├── hooks/
│   ├── useStudyProgress.ts     ← NEW
│   ├── useDrill.ts             ← MODIFIED (gate filter)
│   ├── useProgress.ts          ← MODIFIED (study tracking)
│   └── (others)                ← UNCHANGED
├── db/
│   ├── local.ts                ← MODIFIED (schema v2)
│   ├── sync.ts                 ← MODIFIED (new tables)
├── lib/
│   ├── gates.ts                ← NEW (pure gate functions)
│   └── (others)                ← UNCHANGED
└── supabase/
    └── migrations/
        └── 002_study_progress.sql  ← NEW
```

---

## 7. Migration Strategy

### 7.1 Dexie Migration

`src/db/local.ts` — bump version to 2 and add new tables:

```typescript
this.version(2).stores({
  progress: "id, user_id, exercise_set_id, status, updated_at",
  drillQueue: "id, user_id, exercise_set_id, due_at, updated_at",
  verbHistory: "id, user_id, verb_infinitive, tense, quizzed_at",
  versioned: "key, table_name, record_id, server_updated_at, synced, local_updated_at",
  studyProgress: "id, user_id, entity_type, entity_id, updated_at",       // NEW
  exerciseProgress: "id, user_id, exercise_set_id, updated_at",           // NEW
}).upgrade(tx => {
  // No data migration needed — study_progress starts empty
});
```

### 7.2 Supabase Migration

Run `002_study_progress.sql` (as defined in §3.2). Apply via Lovable's migration system per platform rules.

### 7.3 Route Migration

No breaking changes. `/exercise/:setId` redirects if study not done, but URL stays the same. New routes are additive.

---

## 8. Edge Cases & Error States

| Scenario | Handling |
|----------|----------|
| No internet (offline) | All progress saved to Dexie; syncs when online |
| Empty lesson_text | Show fallback: "Lesson content coming soon" + still allow proceed |
| All exercises complete but no bilan data | Show "Bilan not yet available" with chapter summary |
| DailyDrill with zero studied items | Show "Study first" message with CTA |
| User clears browser data | Progress lost locally; pull from Supabase on next sync |
| Verb has no conjugation for selected tense | Skip that verb/tense combo in quiz generation |
| Chapter has 0 exercise sets with items | Show "No exercises available" — auto-complete progress |
| Bilan references non-existent chapters | Filter to only existing chapters, warn in console |

---

## 9. Implementation Order (Recommended)

| Phase | Task | Dependencies | Agent |
|-------|------|-------------|-------|
| 1 | Dexie schema v2 migration + `useStudyProgress` hook | None | Hadrian |
| 2 | Supabase migration 002 | Phase 1 | Hadrian |
| 3 | `LessonPage.tsx` component | Phase 1 | Vitruvius |
| 4 | `StudyGate.tsx` + gate lib | Phase 1 | Pliny |
| 5 | Modified `ExerciseSet.tsx` (gate + progress) | Phases 3, 4 | Vitruvius |
| 6 | Modified `VerbLookup.tsx` (quiz button) | Phase 1 | Vitruvius |
| 7 | Modified `VerbQuiz.tsx` (tense filter) | Phase 6 | Vitruvius |
| 8 | `BilanPage.tsx` | Phases 1, 5 | Vitruvius |
| 9 | Modified `DailyDrill.tsx` (study gate) | Phase 1 | Vitruvius |
| 10 | Home dashboard rewrite | Phase 1 | Vitruvius |
| 11 | Sync config update | Phase 2 | Pliny |
| 12 | QA (Scipio → Enobarbus) | All phases | Scipio |

---

## 10. Acceptance Criteria

1. **User can navigate:** Chapter → Lesson → Exercises → Bilan → DailyDrill
2. **User can navigate:** VerbList → TenseTable → TenseQuiz → DailyDrill  
3. **Study gates work:** Navigating directly to `/exercise/ch01_1` redirects to `/lesson/ch01` if not studied
4. **DailyDrill only surfaces studied material** (not random verbs/tense combos)
5. **Home dashboard shows study progress** (chapter completion %, last studied, due drills count)
6. **Offline-first:** All progress saved to Dexie; Supabase sync on connectivity
7. **No breaking changes to `/auth` or PWA config**
8. **Existing data schemas** (exercises.json, answers.json, verbs.json) remain unchanged

---

## 11. Design Decisions (Resolved 2026-06-23)

1. **lesson_text population:** Extract from PDF source material fully. No placeholders — the lesson content IS the feature. Phase 0 (data extraction) must run before Phase 3 (LessonPage.tsx).

2. **Bilan answer data:** The 8 bilan entries in `exercises.json` reference chapters but the `answers.json` data may not include bilan-specific answers. Verify answer coverage during Phase 8 (BilanPage.tsx) — if missing, generate quiz items by sampling from referenced chapters.

3. **Study gate UX:** Soft gate. "Skip to Exercises" button with confirmation dialog. Gate is informational, not blocking. `StudyGate` component shows a warning banner but doesn't redirect — the user can always proceed.

4. **DailyDrill card types:** Mixed. Verb conjugation cards AND sentence-completion cards from studied chapters. User needs rehearsal across both types. Card generation pool includes: (a) verb forms from studied tenses, (b) fill-in-blank sentences from studied chapters' exercise sets.

---

## 12. Appendix: Key Type Definitions

```typescript
// src/db/local.ts — new interfaces
export interface LocalStudyProgress {
  id: string;
  user_id: string;
  entity_type: "chapter" | "tense";
  entity_id: string;
  study_completed_at: string | null;
  exercises_completed_at: string | null;
  quiz_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalExerciseProgress {
  id: string;
  user_id: string;
  exercise_set_id: string;
  score_pct: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
```
