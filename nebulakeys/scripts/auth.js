// scripts/auth.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const client = window.NEBULA_PUBLIC;
const supabase = createClient(client.SUPABASE_URL, client.SUPABASE_ANON_KEY);

const form = document.getElementById('auth-form');
const emailEl = document.getElementById('email');
const passEl  = document.getElementById('password');
const steamEl = document.getElementById('steam_user');
const hasAccEl = document.getElementById('has_account');

async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session || null;
}

function toast(msg) { alert(msg); } // usa tu propio toast si quieres

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailEl.value.trim();
  const password = passEl.value;
  const steam_user = steamEl.value.trim();
  const isLogin = hasAccEl.checked;

  try {
    if (isLogin) {
      // ---- LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // sesión garantizada → puedes actualizar
      const userId = data.user.id;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ steam_user })
        .eq('id', userId);

      if (updErr) throw updErr;

      toast('¡Bienvenido! Redirigiendo al panel...');
      window.location.href = '/dashboard.html';
      return;
    }

    // ---- SIGN UP
    const { data: signData, error: signErr } = await supabase.auth.signUp({ email, password });
    if (signErr) throw signErr;

    // Si tu proyecto requiere confirmación por email, aquí NO habrá sesión
    // y cualquier INSERT/UPSERT fallará por RLS. Manejamos ambos casos:
    const session = await ensureSession();
    if (!session) {
      // El trigger handle_new_user() ya insertó la fila en profiles.
      // Pide confirmación y corta aquí.
      toast('Te enviamos un correo para confirmar tu cuenta. Verifica tu email y después inicia sesión.');
      return;
    }

    // Si tienes auto-confirmación (o ya hay sesión), solo ACTUALIZA steam_user
    const userId = session.user.id;
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ steam_user })
      .eq('id', userId);

    if (updErr) throw updErr;

    toast('Cuenta creada. Redirigiendo al panel...');
    window.location.href = '/dashboard.html';
  } catch (err) {
    console.error(err);
    toast(err.message || 'Error al autenticar');
  }
});
