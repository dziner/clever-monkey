create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  page_number int not null,
  kind text not null,
  anchor jsonb not null,
  content jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null default now()
);

create index if not exists annotations_user_doc_page_idx
  on public.annotations (user_id, document_id, page_number);

alter table public.annotations enable row level security;

create policy "annotations_select_own"
  on public.annotations for select
  using (auth.uid() = user_id);

create policy "annotations_insert_own"
  on public.annotations for insert
  with check (auth.uid() = user_id);

create policy "annotations_update_own"
  on public.annotations for update
  using (auth.uid() = user_id);

create policy "annotations_delete_own"
  on public.annotations for delete
  using (auth.uid() = user_id);

create or replace function public.set_annotations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists annotations_set_updated_at on public.annotations;
create trigger annotations_set_updated_at
before update on public.annotations
for each row execute function public.set_annotations_updated_at();
