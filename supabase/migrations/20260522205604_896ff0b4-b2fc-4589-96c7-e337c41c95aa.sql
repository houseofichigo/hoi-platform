
-- Fix mutable search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- These SECURITY DEFINER functions are only used inside RLS policies and
-- the auth trigger. Revoke direct execution from API roles.
revoke execute on function public.is_workspace_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_workspace_role(uuid, uuid, text[]) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
