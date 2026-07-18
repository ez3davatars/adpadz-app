insert into public.admin_users (
  user_id,
  role,
  display_name,
  active
)
select
  id,
  'owner',
  'Adpadz Owner',
  true
from auth.users
where email = 'erik@adpadz.co'
on conflict (user_id) do update
set role = excluded.role,
    display_name = excluded.display_name,
    active = excluded.active;