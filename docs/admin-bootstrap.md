# Admin Bootstrap — Seeding the First Super-Admin

The Library CMS at `/admin/library` is gated by `profiles.role = 'super_admin'`.
No user has this role by default. To grant it to a known user, run the SQL
below against the project's database (via Lovable Cloud → Backend → SQL editor,
or `psql`).

## 1. Find the target user

```sql
select u.id, u.email, p.role
from auth.users u
left join public.profiles p on p.user_id = u.id
where u.email = 'you@example.com';
```

## 2. Promote them

```sql
update public.profiles
set role = 'super_admin'
where user_id = (select id from auth.users where email = 'you@example.com');
```

The user must sign out and back in (or refresh) for the `useSuperAdmin`
hook to pick up the new role.

## 3. Revoke

```sql
update public.profiles
set role = null
where user_id = (select id from auth.users where email = 'you@example.com');
```

## Safety notes

- There is intentionally NO in-app "promote me" button. Self-promotion would
  let any authenticated user grant themselves write access to the global
  Library.
- RLS on `library_items` checks `is_super_admin(auth.uid())` for all writes,
  so promoting a user is the only way to enable CMS writes.
- Only project owners with database access can perform this step.
