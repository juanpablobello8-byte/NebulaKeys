// /scripts/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const cfg = window.NEBULA_PUBLIC;
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    setText('signup-msg', 'Error de configuración (config.js).');
    console.error('NEBULA_PUBLIC no está definido');
    return;
  }

  const supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const $ = (id) => document.getElementById(id);

  // Si ya hay sesión, ir al dashboard
  supa.auth.getSession().then(({ data }) => {
    if (data?.session) window.location.href = '/dashboard.html';
  });

  // Crear cuenta
  $('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('signup-msg', 'Creando cuenta…');
    const { error } = await supa.auth.signUp({
      email: $('signup-email').value.trim(),
      password: $('signup-password').value
    });
    if (error) return setText('signup-msg', '❌ ' + error.message);
    setText('signup-msg', '✅ Cuenta creada. Revisa tu correo para confirmar.');
    // Si desactivas confirmación por email:
    // const { error: e2 } = await supa.auth.signInWithPassword({
    //   email: $('signup-email').value.trim(),
    //   password: $('signup-password').value
    // });
    // if (!e2) window.location.href = '/dashboard.html';
  });

  // Iniciar sesión
  $('signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('signin-msg', 'Iniciando sesión…');
    const { data, error } = await supa.auth.signInWithPassword({
      email: $('signin-email').value.trim(),
      password: $('signin-password').value
    });
    if (error) return setText('signin-msg', '❌ ' + error.message);
    if (data.session) window.location.href = '/dashboard.html';
  });
});
