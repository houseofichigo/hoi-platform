
-- workspace_invitations table
create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create unique index workspace_invitations_pending_unique
  on public.workspace_invitations (workspace_id, lower(email))
  where status = 'pending';

create index workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id);
create index workspace_invitations_token_idx on public.workspace_invitations(token);

alter table public.workspace_invitations enable row level security;

create policy "Members can view workspace invitations"
  on public.workspace_invitations for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

create policy "Owners/admins can create invitations"
  on public.workspace_invitations for insert to authenticated
  with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']));

create policy "Owners/admins or invited user can update invitations"
  on public.workspace_invitations for update to authenticated
  using (
    public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin'])
    or lower(email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  )
  with check (
    public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin'])
    or lower(email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  );

create policy "Owners/admins can delete invitations"
  on public.workspace_invitations for delete to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']));

-- notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications(recipient_user_id, created_at desc);
create index notifications_unread_idx on public.notifications(recipient_user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create policy "Users can delete own notifications"
  on public.notifications for delete to authenticated
  using (recipient_user_id = auth.uid());
-- No INSERT policy: inserts only via SECURITY DEFINER functions/triggers.

-- accept_workspace_invitation RPC
create or replace function public.accept_workspace_invitation(p_token text)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.workspace_invitations;
  v_member public.workspace_members;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.workspace_invitations
  where token = p_token
    and status = 'pending'
    and expires_at > now();

  if not found then
    raise exception 'invalid or expired invitation';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  if lower(v_invitation.email) <> lower(coalesce(v_user_email, '')) then
    raise exception 'invitation is for a different email';
  end if;

  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_invitation.workspace_id and user_id = auth.uid()
  ) then
    update public.workspace_invitations
      set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
      where id = v_invitation.id;
    select * into v_member from public.workspace_members
      where workspace_id = v_invitation.workspace_id and user_id = auth.uid();
    return v_member;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
    values (v_invitation.workspace_id, auth.uid(), v_invitation.role, v_invitation.invited_by)
    returning * into v_member;

  update public.workspace_invitations
    set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    where id = v_invitation.id;

  return v_member;
end;
$$;

-- get_invitation_by_token RPC (public-readable lookup)
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  inviter_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    wi.workspace_id,
    w.name,
    w.slug,
    wi.email,
    wi.role,
    wi.status,
    wi.expires_at,
    u.email::text
  from public.workspace_invitations wi
  join public.workspaces w on w.id = wi.workspace_id
  left join auth.users u on u.id = wi.invited_by
  where wi.token = p_token
  limit 1;
end;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;

-- notify trigger
create or replace function public.notify_inviter_on_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' and new.invited_by is not null then
    insert into public.notifications (recipient_user_id, workspace_id, kind, payload)
    values (
      new.invited_by,
      new.workspace_id,
      'invitation_accepted',
      jsonb_build_object('accepted_email', new.email, 'accepted_by', new.accepted_by)
    );
  end if;
  return new;
end;
$$;

create trigger workspace_invitation_accepted_notify
  after update on public.workspace_invitations
  for each row execute function public.notify_inviter_on_acceptance();
