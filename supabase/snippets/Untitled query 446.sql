select
  au.email,
  admin.role,
  admin.display_name,
  admin.active
from public.admin_users admin
join auth.users au on au.id = admin.user_id;