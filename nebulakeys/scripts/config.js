// /scripts/config.js  (JS plano, SIN <script>)
// ==================================================
window.NEBULA_PUBLIC = {
  // --- Supabase ---
  SUPABASE_URL: "https://uhsggttdnajnhpmlzyud.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoc2dndHRkbmFqbmhwbWx6eXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Nzg2MDksImV4cCI6MjA3NjI1NDYwOX0.KMP5Wts7DgJxEPh8W_SayvsqsOJ7NTMI9lqvMiMKPAg",

  // --- Endpoint serverless que crea la sesión de Stripe Checkout ---
  // Si tu archivo es /api/create-checkout-session.js, cambia la ruta aquí:
  CHECKOUT_ENDPOINT: "/api/create-checkout",

  // --- Rutas útiles (opcional) ---
  PRICING_PAGE: "/pricing.html",
  SUCCESS_PAGE: "/success.html",
  CANCEL_PAGE: "/cancel.html",

  // --- Planes (solo UI). El cobro real lo define CADA id (price_XXX) ---
  PLANS: {
    weekly: {   // $150 Semanal
      id: "price_1SJH1zKwqs0TzO3l23W3RIfE",
      label: "Plan semanal",
      amount: 150,
      interval: "semana",
    },
    biweekly: { // $250 Quincenal
      id: "price_1SJH4eKwqs0TzO3l1ODa7pRx",  // ojo: '1ODa7pRx' (no '1ODDa7pRx')
      label: "Plan quincenal",
      amount: 250,
      interval: "quincena",
    },
    monthly: {  // $350 Mensual
      id: "price_1SJH9FKwqs0TzO3lxTTonf6H",
      label: "Plan mensual",
      amount: 350,
      interval: "mes",
    },
  },
};

};
</script>
