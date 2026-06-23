# Design Brief: Study-Before-Test Pedagogical Architecture

**Date:** 2026-06-23
**Repo:** ~/projects/french-study-app
**Assignee:** Swarm design team (cincinnatus)
**Output:** `.artifacts/DESIGN_PROPOSAL.md` with full technical spec

## Problem

Every quiz/exercise in the app drops the user straight into testing with zero study material first. The textbook (Grammaire Progressive du Francais) has a lesson->exercise structure (left page = lesson text, right page = exercises), but the app only built the exercise half. The user has no way to study before being tested.

## Current State (what exists)

| Feature | What it does | What's missing |
|---------|-------------|----------------|
| **ExerciseSet** | Pick chapter -> pick set -> fill-in blanks | `lesson_text` is already extracted from PDF but never shown to the user |
| **VerbLookup** | Browse/search 12 verbs x 14 tense conjugation tables | No connection to quizzes. Study-only, no path to testing |
| **VerbQuiz** | Random verb, random tense, start typing | No "study this tense first" mode. No reference material accessible from quiz |
| **DailyDrill** | SRS flashcards for spaced repetition | Cards appear as first contact with material. Should be REVIEW, not first exposure |
| **Bilans** (chapter reviews) | Data extracted from PDF, no UI page exists | End-of-chapter review tests — gated behind completing lesson + exercises |

## Data already available

- **exercises.json**: 50 chapters with `lesson_text` field populated per chapter
- **answers.json**: 138 exercise sets with blanks, answers, and sentence context
- **verbs.json**: 12 verbs x 14 tenses x 6 pronouns = 1,008 conjugated forms + idioms
- **Supabase**: progress tracking tables, drill_queue for SRS scheduling
- **Dexie (local)**: offline-first progress persistence

## Desired Pedagogical Flow

The app should enforce: **Study -> Practice -> Quiz -> Review (SRS)**

```
CHAPTER FLOW:
  Lesson Page (read grammar rule + examples from lesson_text)
    |
    v
  Practice Exercises (fill-in-blanks for that chapter, with sentence context + audio)
    |
    v
  Chapter Quiz (bilan — tests everything from the chapter)
    |
    v
  SRS Review (DailyDrill surfaces weak items on schedule)

VERB FLOW:
  Study a Tense (see all 12 verbs conjugated in present/imparfait/etc.)
    |
    v
  Tense Quiz (quiz ONLY on the tense just studied, not random)
    |
    v
  SRS Review (DailyDrill surfaces weak verb forms on schedule)
```

## Design Requirements

1. **Lesson pages** — Create a new page/route that shows `lesson_text` before any exercise. The user reads the grammar rule, then clicks "Start Exercises" to begin fill-in-blanks for that chapter.

2. **Study-before-quiz gate** — No exercise or quiz should be accessible without the user first seeing (or explicitly skipping) the study material. Track this in local progress (Dexie).

3. **Verb study mode** — Repurpose or extend VerbLookup so that after viewing a tense's conjugation table, the user can tap "Quiz Me on This Tense" which navigates to a filtered VerbQuiz only testing that tense.

4. **Bilan pages** — Build the missing Bilan UI. After completing a chapter's exercises, the user can take the bilan (chapter review) testing everything from that chapter.

5. **SRS positioning** — DailyDrill should NOT show cards the user hasn't studied yet. Only surface items from chapters/verbs the user has completed the "study" step for.

6. **Progress tracking** — Update the Dexie schema to track: study_completed (per chapter/tense), exercises_completed (per set), quiz_completed (per bilan/tense). Home dashboard should reflect this.

7. **Navigation flow** — The Home quick actions should be reorganized to guide the user through Study -> Practice -> Quiz, not just drop them into random modes.

## Constraints

- Must work offline (Dexie-first, Supabase sync)
- Must respect existing data schemas (exercises.json, answers.json, verbs.json)
- Must preserve existing auth flow (Google OAuth + email)
- Preserve existing PWA configuration
- No breaking changes to existing routes that would invalidate QA-tested pages

## Success Criteria

- User can navigate: Chapter -> Lesson -> Exercises -> Bilan -> DailyDrill
- User can navigate: VerbList -> TenseTable -> TenseQuiz -> DailyDrill
- DailyDrill only surfaces studied material
- Home dashboard shows clear study progress, not just raw stats
