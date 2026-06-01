# Admin Bootstrap — Seeding the First HOI Admin

The internal admin backend at `/admin` is gated by `hoi_admin_users`.
No user has this role by default. To grant it to a known House of Ichigo
operator, run the SQL below against the project's database.

## 1. Find the target user

```sql
select u.id, u.email, a.role, a.status
from auth.users u
left join public.hoi_admin_users a on a.user_id = u.id
where u.email = 'you@example.com';
```

## 2. Promote them

```sql
insert into public.hoi_admin_users (user_id, role, status, created_by)
values (
  (select id from auth.users where email = 'you@example.com'),
  'owner',
  'active',
  (select id from auth.users where email = 'you@example.com')
)
on conflict (user_id) do update
set role = excluded.role,
    status = 'active',
    updated_at = now();
```

The user must sign out and back in, or refresh, for `useHoiAdmin` to pick up
the new role.

## 3. Revoke

```sql
update public.hoi_admin_users
set status = 'suspended'
where user_id = (select id from auth.users where email = 'you@example.com');
```

## Safety notes

- There is intentionally NO in-app "promote me" button.
- HOI admin access is separate from customer workspace roles.
- `profiles.role` is legacy and is no longer the source of truth for admin
  access.
- RLS on admin tables checks `is_hoi_admin(auth.uid())`.
- Only project owners with database access can perform this step.
