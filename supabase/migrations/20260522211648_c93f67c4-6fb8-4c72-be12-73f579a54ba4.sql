-- 1. Slug format constraint (defense in depth vs client-side validation)
alter table public.workspaces
  add constraint workspaces_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40);

-- 2. Atomic workspace creation: workspace + owner membership + default workspace
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws public.workspaces;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (name, slug)
    values (p_name, p_slug)
    returning * into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (v_ws.id, v_uid, 'owner');

  update public.profiles
    set default_workspace_id = v_ws.id
    where user_id = v_uid;

  return v_ws;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;