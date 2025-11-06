// /scripts/auth.js
// Login/Registro con Supabase + guardado/actualización en la tabla profiles

// === Ajustes ===
const REDIRECT_AFTER_LOGIN = "/dashboard.html";
const PROFILE_TABLE = "profiles"; // cambia si tu tabla se llama distinto
const PROFILE_STEAM_COLUMN = "steam_user"; // cambia si usas 'steam_username'
const PROFILE_EMAIL_COLUMN = "email";

// Helpers de UI
const $ = (id) => document.getElementById(id);
const toast = (msg, type = "info") => {
  const box = $("toast");
  if (!box) return;
  box.textContent = msg;
  box.className =
    "pointer-events-none fixed top-4 right-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-2xl " +
    (type === "error"
      ? "bg-red-900/80 border-red-500/40"
      : type === "success"
      ? "bg-emerald-900/80 border-emerald-500/40"
      : "bg-[#121826] border-white/10");
  box.style.display = "block";
  setTimeout(() => (box.style.display = "none"), 4200);
};

const setLoading = (loading) => {
  $("submitBtn").disabled = loading;
  $("btnSpinner").classList.toggle("hidden", !loading);
};

// Cliente Supabase
const supa =
  window.supabase ||
  supabase.createClient(
    window.NEBULA_PUBLIC.SUPABASE_URL,
    window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
  );

// Mostrar/Ocultar contraseña
$("togglePass").addEventListener("click", () => {
  const input = $("password");
  input.type = input.type === "password" ? "text" : "password";
  $("togglePass").textContent = input.type === "password" ? "👁️" : "🙈";
});

// Upsert del perfil en la tabla profiles
async function ensureProfile({ userId, email, steam }) {
  // Ajusta los nombres de columnas si es necesario
  const payload = {
    id: userId,
    [PROFILE_EMAIL_COLUMN]: email,
    [PROFILE_STEAM_COLUMN]: steam ?? null,
    updated_at: new Date().toISOString(),
  };

  // Si tu tabla no tiene updated_at, puedes quitarlo
  const { error } = await supa
    .from(PROFILE_TABLE)
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
}

// Registro (sign up)
async function handleSignUp({ email, password, steam }) {
  // 1) Crear usuario de auth
  const { data, error } = await supa.auth.signUp({
    email,
    password,
  });
  if (error) throw error;

  const user = data.user;
  if (!user) throw new Error("No se pudo crear el usuario.");

  // 2) Crear/actualizar perfil
  await ensureProfile({ userId: user.id, email, steam });

  // 3) Listo
  toast("Cuenta creada correctamente. Redirigiendo…", "success");
  window.location.assign(REDIRECT_AFTER_LOGIN);
}

// Login (sign in)
async function handleSignIn({ email, password, steam }) {
  const { data, error } = await supa.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  const user = data.user;
  if (!user) throw new Error("No se pudo iniciar sesión.");

  // (Opcional) actualizar steam_user si el usuario escribió algo
  if (steam && steam.trim().length > 0) {
    try {
      await ensureProfile({ userId: user.id, email, steam });
    } catch (e) {
      // No bloqueamos el login si falla el update de perfil
      console.warn("No se pudo actualizar steam_user:", e);
    }
  }

  toast("Bienvenido. Redirigiendo…", "success");
  window.location.assign(REDIRECT_AFTER_LOGIN);
}

// Submit del formulario
$("authForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  // Lectura de campos
  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  const steam = $("steam").value.trim();
  const hasAccount = $("hasAccount").checked;

  if (!email || !password) {
    toast("Completa email y contraseña.", "error");
    return;
  }
  if (!hasAccount && steam.length === 0) {
    toast("Para crear tu cuenta, ingresa tu usuario de Steam.", "error");
    return;
  }

  setLoading(true);

  try {
    if (hasAccount) {
      await handleSignIn({ email, password, steam });
    } else {
      await handleSignUp({ email, password, steam });
    }
  } catch (err) {
    console.error(err);
    // Mensajes comunes de Supabase
    const msg =
      err?.message ||
      err?.error_description ||
      "No se pudo completar la acción.";
    toast(msg, "error");
  } finally {
    setLoading(false);
  }
});

// Si el usuario ya tiene sesión, lo mandamos directo al dashboard
(async () => {
  const { data } = await supa.auth.getUser();
  if (data?.user) {
    window.location.replace(REDIRECT_AFTER_LOGIN);
  }
})();
