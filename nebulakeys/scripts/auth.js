// /scripts/auth.js
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // Verifica que config se haya cargado
    if (!window.NEBULA_PUBLIC?.SUPABASE_URL || !window.NEBULA_PUBLIC?.SUPABASE_ANON_KEY) {
      console.error('❌ Falta SUPABASE_URL o SUPABASE_ANON_KEY en window.NEBULA_PUBLIC');
      alert('Error de configuración (Supabase). Revisa /scripts/config.js');
      return;
    }

    // Crea cliente supabase
    const supabase = window.supabase.createClient(
      window.NEBULA_PUBLIC.SUPABASE_URL,
      window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
    );

    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const steamEl = document.getElementById('steamUser');
    const isLoginEl = document.getElementById('isLogin');
    const btn = document.getElementById('submitBtn');

    // Debug de existencia de form
    console.log('📄 loginForm encontrado?', !!form);

    // Si no hay form, nada que hacer
    if (!form) return;

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault(); // <- evita recarga
      const email = emailEl.value.trim();
      const password = passEl.value;
      const steam_user = (steamEl.value || '').trim();
      const isLogin = isLoginEl.checked;

      if (!email || !password) {
        alert('Completa email y contraseña.');
        return;
      }
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = isLogin ? 'Iniciando…' : 'Creando cuenta…';

      try {
        console.log('🟣 Intento:', isLogin ? 'signIn' : 'signUp', { email, steam_user });

        if (isLogin) {
          // LOGIN
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;

          // actualiza steam_user si se escribió
          const user = data.user;
          if (steam_user) {
            await supabase.from('profiles').update({ steam_user }).eq('id', user.id);
          }

          window.location.href = '/dashboard.html';
          return;
        }

        // SIGNUP
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { steam_user } } // metadata en auth.users (opcional)
        });

        if (error) {
          // Si ya existe, intentamos login directo
          if (error.message && /already registered|User already registered/i.test(error.message)) {
            console.log('⚠️ Usuario ya existe. Probando login…');
            const r2 = await supabase.auth.signInWithPassword({ email, password });
            if (r2.error) throw r2.error;

            const user = r2.data.user;
            if (steam_user) await supabase.from('profiles').update({ steam_user }).eq('id', user.id);
            window.location.href = '/dashboard.html';
            return;
          }
          throw error;
        }

        // Si tienes confirmación de email desactivada, tendrás sesión. Si no, no.
        const user = data.user;
        if (user) {
          // nos aseguramos de setear steam_user en profiles
          if (steam_user) {
            await supabase.from('profiles')
              .upsert({ id: user.id, email, steam_user }, { onConflict: 'id' });
          }
          window.location.href = '/dashboard.html';
        } else {
          alert('Te enviamos un correo de confirmación. Revisa tu bandeja.');
          form.reset();
        }
      } catch (err) {
        console.error('❌ Auth error:', err);
        alert(err?.message || 'Error de autenticación.');
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });
})();
