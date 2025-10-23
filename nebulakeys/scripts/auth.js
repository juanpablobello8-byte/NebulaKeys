import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function register() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const steam = document.getElementById('steam').value.trim();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) { alert(error.message); return; }

  const userId = data.user?.id;
  await supabase.from('profiles').upsert({
    id: userId,
    email,
    steam_username: steam || null
  });

  // redirige donde quieras
  location.href = '/dashboard.html';
}
