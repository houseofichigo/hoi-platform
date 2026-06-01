-- Helper: super-admin check (reads profiles.role)
create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where user_id = _user_id and role = 'super_admin'
  )
$$;

-- library_items table
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null,
  type text not null,
  title text not null,
  summary text,
  module_ids text[] not null default '{}',
  phase_ids text[] not null default '{}',
  tags text[] not null default '{}',
  published boolean not null default false,
  content_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint library_items_type_check check (type in (
    'prompts','agents','assistants','tools','videos','presentations',
    'documents','case_studies','regulatory','use_case_templates',
    'glossary','research','skills'
  ))
);

-- Indexes
create index library_items_type_idx on public.library_items (type);
create index library_items_published_idx on public.library_items (published);
create index library_items_created_at_idx on public.library_items (created_at desc);
create index library_items_module_ids_idx on public.library_items using gin (module_ids);
create index library_items_phase_ids_idx on public.library_items using gin (phase_ids);
create index library_items_tags_idx on public.library_items using gin (tags);
create index library_items_type_pub_created_idx on public.library_items (type, published, created_at desc);

-- updated_at trigger (reuses existing function)
create trigger library_items_set_updated_at
before update on public.library_items
for each row execute function public.set_updated_at();

-- RLS
alter table public.library_items enable row level security;

create policy "Authenticated users can read published global items"
on public.library_items for select
to authenticated
using (workspace_id is null and published = true);

create policy "Super-admins can read all library items"
on public.library_items for select
to authenticated
using (public.is_super_admin(auth.uid()));

create policy "Super-admins can insert library items"
on public.library_items for insert
to authenticated
with check (public.is_super_admin(auth.uid()));

create policy "Super-admins can update library items"
on public.library_items for update
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

create policy "Super-admins can delete library items"
on public.library_items for delete
to authenticated
using (public.is_super_admin(auth.uid()));

-- Storage bucket: library-files (public read)
insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public can read library-files"
on storage.objects for select
to public
using (bucket_id = 'library-files');

create policy "Super-admins can upload library-files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'library-files' and public.is_super_admin(auth.uid()));

create policy "Super-admins can update library-files"
on storage.objects for update
to authenticated
using (bucket_id = 'library-files' and public.is_super_admin(auth.uid()))
with check (bucket_id = 'library-files' and public.is_super_admin(auth.uid()));

create policy "Super-admins can delete library-files"
on storage.objects for delete
to authenticated
using (bucket_id = 'library-files' and public.is_super_admin(auth.uid()));