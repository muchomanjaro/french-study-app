-- ============================================================
-- French Study App — Initial Schema (Migration 001)
-- Tables, RLS policies, and indexes for core application data
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. Profiles
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    username      text unique,
    full_name     text,
    avatar_url    text,
    target_level  text check (target_level in ('A1','A2','B1','B2','C1','C2')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- 2. Progress (exercise-set level tracking)
create table if not exists public.progress (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    exercise_set_id text not null,
    status          text not null default 'not_started'
                        check (status in ('not_started','in_progress','completed')),
    score_pct       numeric(5,2) check (score_pct >= 0 and score_pct <= 100),
    completed_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    unique (user_id, exercise_set_id)
);

-- 3. Drill queue (SRS spaced-repetition card queue)
create table if not exists public.drill_queue (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references public.profiles(id) on delete cascade,
    exercise_set_id  text not null,
    item_id          text not null,
    blank_id         text not null,
    due_at           timestamptz not null default now(),
    interval_days    integer not null default 1,
    ease_factor      numeric(4,2) not null default 2.50
                         check (ease_factor >= 1.30 and ease_factor <= 5.00),
    repetitions      integer not null default 0,
    last_reviewed_at timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),

    unique (user_id, exercise_set_id, item_id, blank_id)
);

-- 4. Verb quiz history
create table if not exists public.verb_quiz_history (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references public.profiles(id) on delete cascade,
    verb_infinitive   text not null,
    tense             text not null,
    pronoun_index     smallint not null check (pronoun_index between 0 and 5),
    user_answer       text not null,
    correct_answer    text not null,
    is_correct        boolean not null,
    quizzed_at        timestamptz not null default now(),
    created_at        timestamptz not null default now()
);

-- 5. Indexes
create index if not exists idx_progress_user_id       on public.progress(user_id);
create index if not exists idx_progress_status         on public.progress(status);
create index if not exists idx_drill_queue_user_id     on public.drill_queue(user_id);
create index if not exists idx_drill_queue_due_at      on public.drill_queue(due_at)
    where due_at <= now();
create index if not exists idx_verb_quiz_user_id       on public.verb_quiz_history(user_id);
create index if not exists idx_verb_quiz_verb_tense    on public.verb_quiz_history(verb_infinitive, tense);
create index if not exists idx_verb_quiz_quizzed_at    on public.verb_quiz_history(quizzed_at desc);

-- 6. Row Level Security
alter table public.profiles            enable row level security;
alter table public.progress             enable row level security;
alter table public.drill_queue          enable row level security;
alter table public.verb_quiz_history    enable row level security;

-- Profiles: users can read/update their own profile; insert handled by trigger
create policy "Users can read own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy "Users can insert own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- Progress: full CRUD on own rows
create policy "Users can read own progress"
    on public.progress for select
    using (auth.uid() = user_id);

create policy "Users can insert own progress"
    on public.progress for insert
    with check (auth.uid() = user_id);

create policy "Users can update own progress"
    on public.progress for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete own progress"
    on public.progress for delete
    using (auth.uid() = user_id);

-- Drill queue: full CRUD on own rows
create policy "Users can read own drill queue"
    on public.drill_queue for select
    using (auth.uid() = user_id);

create policy "Users can insert own drill queue"
    on public.drill_queue for insert
    with check (auth.uid() = user_id);

create policy "Users can update own drill queue"
    on public.drill_queue for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete own drill queue"
    on public.drill_queue for delete
    using (auth.uid() = user_id);

-- Verb quiz history: read/insert only (immutable record)
create policy "Users can read own verb quiz history"
    on public.verb_quiz_history for select
    using (auth.uid() = user_id);

create policy "Users can insert own verb quiz history"
    on public.verb_quiz_history for insert
    with check (auth.uid() = user_id);

-- 7. Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger set_progress_updated_at
    before update on public.progress
    for each row execute function public.set_updated_at();

create trigger set_drill_queue_updated_at
    before update on public.drill_queue
    for each row execute function public.set_updated_at();

-- 8. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'avatar_url'
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
