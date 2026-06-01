
-- =========================================
-- Tables
-- =========================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'free' check (plan in ('free','team','enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_id_idx on public.workspace_members(workspace_id);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  default_workspace_id uuid references public.workspaces(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- Security definer helpers (avoid RLS recursion)
-- =========================================

create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = _user_id
  )
$$;

create or replace function public.has_workspace_role(_workspace_id uuid, _user_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = _user_id
      and role = any(_roles)
  )
$$;

-- =========================================
-- Enable RLS
-- =========================================

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;

-- =========================================
-- workspaces policies
-- =========================================

create policy "Members can view their workspaces"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id, auth.uid()));

create policy "Authenticated users can create workspaces"
on public.workspaces for insert
to authenticated
with check (auth.uid() is not null);

create policy "Owners and admins can update workspaces"
on public.workspaces for update
to authenticated
using (public.has_workspace_role(id, auth.uid(), array['owner','admin']))
with check (public.has_workspace_role(id, auth.uid(), array['owner','admin']));

create policy "Owners can delete workspaces"
on public.workspaces for delete
to authenticated
using (public.has_workspace_role(id, auth.uid(), array['owner']));

-- =========================================
-- workspace_members policies
-- =========================================

create policy "Members can view co-members"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id, auth.uid()));

-- Allows owners/admins to add members; also allows the creator of a brand-new
-- workspace to seat themselves as the first owner (bootstrap case).
create policy "Owners/admins can add members; creator can seat first owner"
on public.workspace_members for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin'])
  or (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
    )
  )
);

create policy "Owners/admins can update members; users can update self"
on public.workspace_members for update
to authenticated
using (
  public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin'])
  or user_id = auth.uid()
)
with check (
  public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin'])
  or user_id = auth.uid()
);

create policy "Owners/admins can remove members; users can remove themselves"
on public.workspace_members for delete
to authenticated
using (
  public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin'])
  or user_id = auth.uid()
);

-- =========================================
-- profiles policies
-- =========================================

create policy "Authenticated users can view any profile"
on public.profiles for select
to authenticated
using (auth.uid() is not null);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own profile"
on public.profiles for delete
to authenticated
using (user_id = auth.uid());

-- =========================================
-- updated_at triggers
-- =========================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- =========================================
-- Auth signup -> profile trigger
-- =========================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
