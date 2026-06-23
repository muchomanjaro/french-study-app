-- Migration 002: Study progress tracking for study-before-test architecture
-- Run via Lovable migration system per platform rules.

-- Study progress per entity (chapter or tense)
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

-- Users can only read their own study progress
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

-- Exercise-level progress tracking
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

CREATE POLICY "Users read own exercise progress"
    ON public.exercise_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own exercise progress"
    ON public.exercise_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own exercise progress"
    ON public.exercise_progress FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indexes for efficient lookups
CREATE INDEX idx_study_progress_user ON public.study_progress(user_id, entity_type);
CREATE INDEX idx_exercise_progress_user ON public.exercise_progress(user_id, exercise_set_id);
