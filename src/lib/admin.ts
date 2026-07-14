import { supabase } from './supabase';

export async function getAdminAccess() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await supabase.rpc('is_adpadz_admin');
  return !error && data === true;
}
