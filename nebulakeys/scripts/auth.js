// /scripts/auth.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const steamInput = document.getElementById('steam');
const errorBox = document.getElementById('authError');
const isLoginToggle = document.getElementById('modeToggle');

function setError(msg) {
  errorBox.textContent = msg || '';
  errorBox.classList.toggle('hidden', !msg);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');

  const email = emailInput.value.trim();
  const pass = passInput.value.trim();
  const steam = steamInput.value.trim();
  const mode = isLoginToggle.checked ? 'login' : 'signup';

  try {
    let authRes;
    if (mode === 'signup') {
      authRes = await supabase.auth.signUp({
        email,
        password: pass
      });
    } else {
      authRes = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
    }

    if (authRes.error) {
      throw authRes.error;
    }

    const user = authRes.data.user;
    if (!user) {
      throw new Error('No user returned');
    }

    // Guardar/actualizar perfil con steam_username
    await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          steam_username: steam || null
        },
        { onConflict: 'id' }
      );

    // listo → redirige al dashboard
    window.location.href = '/dashboard.html';
  } catch (err) {
    console.error(err);
    setError('Error: ' + err.message);
  }
});
