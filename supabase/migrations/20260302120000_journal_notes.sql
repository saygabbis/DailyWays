-- Tabela de notas do Diário
create table if not exists public.journal_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null default '',
    content text not null default '',
    pinned boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.journal_notes enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'journal_notes'
          and policyname = 'journal_notes_select_own'
    ) then
        create policy "journal_notes_select_own"
            on public.journal_notes
            for select
            using (auth.uid() = user_id);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'journal_notes'
          and policyname = 'journal_notes_insert_own'
    ) then
        create policy "journal_notes_insert_own"
            on public.journal_notes
            for insert
            with check (auth.uid() = user_id);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'journal_notes'
          and policyname = 'journal_notes_update_own'
    ) then
        create policy "journal_notes_update_own"
            on public.journal_notes
            for update
            using (auth.uid() = user_id);
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'journal_notes'
          and policyname = 'journal_notes_delete_own'
    ) then
        create policy "journal_notes_delete_own"
            on public.journal_notes
            for delete
            using (auth.uid() = user_id);
    end if;
end
$$;

