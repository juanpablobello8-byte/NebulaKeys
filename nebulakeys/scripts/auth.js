// /scripts/auth.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// leemos la config pública
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NEBULA_PUBLIC;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// elementos del DOM
const form       = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const steamInput = document.getElementById('steam');
const modeToggle = document.getElementById('modeToggle');
const submitBtn  = document.getElementById('submitBtn');
const errorBox   = document.getElementById('authError');

function showError(msg) {
  if (!msg) {
    errorBox.classList.remove('show');
    errorBox.textContent = '';
  } else {
    errorBox.classList.add('show');
    errorBox.textContent = msg;
  }
}

form.addEventListener('submit', async (evt) => {
  evt.preventDefault();
  showError('');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Procesando...';

  const email = emailInput.value.trim();
  const pass  = passInput.value;
  const steam = steamInput.value.trim();
  const loginMode = modeToggle.checked; // true = login, false = signup

  try {
    let authRes;
    if (loginMode) {
      // INICIAR SESIÓN
      authRes = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
    } else {
      // CREAR CUENTA
      authRes = await supabase.auth.signUp({
        email,
        password: pass
      });
    }

    if (authRes.error) {
      throw authRes.error;
    }

    const user = authRes.data.user;
    if (!user) {
      throw new Error(
        'No se devolvió usuario. ¿Está habilitado sign-up sin confirmación de email en Supabase?'
      );
    }

    // Guardar / actualizar perfil en "profiles"
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,              // mismo id que auth.users
          email: user.email,
          steam_username: steam || null
        },
        { onConflict: 'id' }
      );

    if (profileErr) {
      console.warn('No se pudo guardar perfil en profiles:', profileErr.message);
      // No rompo el flujo por esto
    }

    // OK → al dashboard
    window.location.href = '/dashboard.html';
  } catch (err) {
    console.error('[auth error]', err);
    showError('Error: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continuar';
  }
});
