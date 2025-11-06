// /scripts/home.js

// Rutas de imágenes de planes
// OJO: si cambiaste los nombres en GitHub, ajusta aquí.
// Con espacios, deben ir codificados como %20.
const PLAN_IMAGES = {
  starter: "/assets/plans/Starter%20Pack.png",
  priority: "/assets/plans/Pro%20Pack.png",
  ultimate: "/assets/plans/Priority%20Pack.png", // usamos tu "Pro Pack" para Ultimate
};

// Asigna imágenes a las tarjetas (por si alguna no cargó)
(function assignPlanImages() {
  const imgStarter = document.getElementById("img-starter-plan");
  const imgPriority = document.getElementById("img-priority-plan");
  const imgUltimate = document.getElementById("img-ultimate-plan");
  if (imgStarter) imgStarter.src = PLAN_IMAGES.starter;
  if (imgPriority) imgPriority.src = PLAN_IMAGES.priority;
  if (imgUltimate) imgUltimate.src = PLAN_IMAGES.ultimate;
})();

// ===== Mostrar/ocultar "Ver planes" según sesión =====
async function bootAuthVisibility() {
  try {
    // Crear cliente Supabase (usa los datos de /scripts/config.js)
    const supa =
      window.supabase ||
      supabase.createClient(
        window.NEBULA_PUBLIC.SUPABASE_URL,
        window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
      );

    const btnViewPlans = document.getElementById("btnViewPlans");
    if (!btnViewPlans) return;

    const setVisible = (on) => {
      if (on) btnViewPlans.classList.remove("hidden");
      else btnViewPlans.classList.add("hidden");
    };

    // Estado inicial
    const { data } = await supa.auth.getUser();
    setVisible(!!data?.user);

    // Suscríbete a cambios de sesión
    supa.auth.onAuthStateChange((_event, session) => {
      setVisible(!!session?.user);
    });
  } catch (err) {
    // Si algo falla, deja oculto el botón (comportamiento seguro)
    console.error("[home] auth visibility error:", err);
  }
}

bootAuthVisibility();
