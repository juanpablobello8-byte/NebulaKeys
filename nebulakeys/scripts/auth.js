// /scripts/auth.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.NEBULA_PUBLIC;
if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
  alert("Falta configuración de Supabase. Revisa /scripts/config.js");
  throw new Error("NEBULA_PUBLIC config missing");
}

const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

// UI
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const steamEl = document.getElementById("steam");
const haveAccountEl = document.getElementById("haveAccount");
const submitBtn = document.getElementById("submitBtn");

// Helper UI
function lock(b) {
  submitBtn.disabled = b;
  submitBtn.textContent = b ? "Procesando..." : "Continuar";
}
function toast(msg) {
  alert(msg);
}

// Upsert perfil
async function upsertProfile(userId, email, steamUser) {
  // Ajusta los nombres de columnas si difieren en tu tabla
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,          // asumiendo PK = uuid del auth
        email: email,
        steam_username: steamUser || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) throw error;
}

async function signInFlow(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  // Opcional: asegurar que existe perfil
  const user = data.user;
  if (user) {
    try {
      await upsertProfile(user.id, user.email, null);
    } catch (e) {
      console.warn("upsert profile on sign-in:", e);
    }
  }
  return data;
}

async function signUpFlow(email, password, steamUser) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // útil si quieres guardar metadatos
      data: { steam_username: steamUser || null },
      // emailRedirectTo: '<tu_url>/...' (si usas confirmación por correo)
    },
  });
  if (error) throw error;

  // Si tienes deshabilitada la confirmación por correo, user viene lleno
  // Si la confirmación está habilitada, user puede venir null y te dirá que verifiques email
  if (!data.user) {
    toast("Revisa tu correo y confirma tu cuenta para continuar.");
    return data;
  }

  // Crear/actualizar perfil
  await upsertProfile(data.user.id, email, steamUser);
  return data;
}

submitBtn?.addEventListener("click", async () => {
  try {
    lock(true);
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";
    const steam = (steamEl?.value || "").trim();
    const isLogin = !!haveAccountEl?.checked;

    if (!email || !password) {
      toast("Escribe email y contraseña.");
      return;
    }
    if (!isLogin && !steam) {
      toast("Escribe tu usuario de Steam para registrar la cuenta.");
      return;
    }

    if (isLogin) {
      const { user } = await signInFlow(email, password);
      if (user) location.href = "/dashboard.html";
      else toast("Inicio de sesión correcto. Redirigiendo...");
    } else {
      const { user } = await signUpFlow(email, password, steam);
      if (user) {
        toast("Cuenta creada. Redirigiendo...");
        location.href = "/dashboard.html";
      } else {
        // Confirmación de correo activada
        toast("Te enviamos un correo de confirmación. Verifícalo para continuar.");
      }
    }
  } catch (err) {
    console.error(err);
    toast(`Error: ${err?.message || err}`);
  } finally {
    lock(false);
  }
});

// Autorellenar en caso de estar logueado y llegar aquí
(async () => {
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    // Ya logueado
    location.replace("/dashboard.html");
  }
})();
