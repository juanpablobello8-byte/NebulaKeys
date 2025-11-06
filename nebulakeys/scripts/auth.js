/* /scripts/auth.js
   NebulaKeys — autenticación con Supabase + guardado de perfil
   Requiere:
     - /scripts/config.js (define window.NEBULA_PUBLIC)
     - @supabase/supabase-js v2 (CDN global window.supabase)
*/

(() => {
  // ======= Config =========
  const REDIRECT_AFTER_LOGIN = "/dashboard.html";
  const PROFILE_TABLE = "profiles";
  const PROFILE_EMAIL_COLUMN = "email";
  const PROFILE_STEAM_COLUMN = "steam_user";

  // ======= Helpers UI ======
  const $ = (sel) => document.querySelector(sel);

  const toast = (msg, type = "info") => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.className =
      "fixed top-4 right-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-2xl transition " +
      (type === "error"
        ? "bg-red-900/85 border-red-500/40 text-red-50"
        : type === "success"
        ? "bg-emerald-900/85 border-emerald-500/40 text-emerald-50"
        : "bg-slate-900/85 border-white/10 text-slate-100");
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 4200);
  };

  const setLoading = (v) => {
    const btn = $("#submitBtn");
    const spn = $("#btnSpinner");
    if (btn) btn.disabled = v;
    if (spn) spn.classList.toggle("hidden", !v);
  };

  // ======= Cliente Supabase (FIX) ======
  if (!window.supabase) {
    throw new Error(
      "Supabase SDK no cargó. Revisa la etiqueta <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'>"
    );
  }
  if (!window.NEBULA_PUBLIC?.SUPABASE_URL || !window.NEBULA_PUBLIC?.SUPABASE_ANON_KEY) {
    throw new Error("Falta configuración de Supabase en window.NEBULA_PUBLIC");
  }

  // ⚠️ Siempre crear el cliente. NO usar directamente window.supabase como objeto.
  const supa = window.supabase.createClient(
    window.NEBULA_PUBLIC.SUPABASE_URL,
    window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
  );

  // ======= Validación simple ======
  const validate = (email, password, steam, isLogin) => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) return "Email inválido.";
    if (!password || password.length < 6)
      return "La contraseña debe tener al menos 6 caracteres.";
    if (!isLogin && !steam) return "Escribe tu usuario de Steam.";
    return null;
  };

  // ======= Guardar/actualizar perfil ======
  const upsertProfile = async (email, steamUser) => {
    const { error } = await supa
      .from(PROFILE_TABLE)
      .upsert(
        { [PROFILE_EMAIL_COLUMN]: email, [PROFILE_STEAM_COLUMN]: steamUser },
        { onConflict: PROFILE_EMAIL_COLUMN }
      );
    if (error) throw error;
  };

  // ======= Handlers =======
  const handleAuth = async (ev) => {
    ev.preventDefault();
    setLoading(true);

    try {
      const email = $("#email").value.trim();
      const password = $("#password").value;
      const steam = $("#steam").value.trim();
      const isLogin = $("#haveAccount").checked;

      const msg = validate(email, password, steam, isLogin);
      if (msg) throw new Error(msg);

      if (isLogin) {
        // ---- Iniciar sesión
        const { data, error } = await supa.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Intento de completar/actualizar perfil con el steam del formulario si lo envió
        if (steam) {
          try {
            await upsertProfile(email, steam);
          } catch (e) {
            // No romper el login por esto
            console.warn("upsert profile (login) warning:", e);
          }
        }

        toast("¡Bienvenido de nuevo!", "success");
        window.location.href = REDIRECT_AFTER_LOGIN;
        return;
      }

      // ---- Registro
      const { data, error } = await supa.auth.signUp({
        email,
        password,
        options: {
          // Si tienes confirmación por email en Supabase, puedes usar una redirect aquí:
          // emailRedirectTo: window.location.origin + "/success.html",
          data: { steam_user: steam }, // metadatos útiles
        },
      });
      if (error) throw error;

      // Guardamos/actualizamos perfil propio
      await upsertProfile(email, steam);

      toast("Cuenta creada. ¡Bienvenid@!", "success");
      window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (err) {
      console.error(err);
      const msg =
        err?.message ||
        err?.error_description ||
        "No se pudo completar la operación.";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // ======= Eventos UI =======
  const form = $("#authForm");
  if (form) form.addEventListener("submit", handleAuth);

  const togglePassword = $("#togglePassword");
  if (togglePassword) {
    togglePassword.addEventListener("click", () => {
      const inp = $("#password");
      if (!inp) return;
      inp.type = inp.type === "password" ? "text" : "password";
      togglePassword.classList.toggle("opacity-40");
    });
  }

  // Autoredirección si ya hay sesión
  (async () => {
    const {
      data: { session },
    } = await supa.auth.getSession();
    if (session) {
      // ya autenticado
      // window.location.href = REDIRECT_AFTER_LOGIN;
    }
  })();
})();
