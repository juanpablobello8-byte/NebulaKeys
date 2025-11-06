// ===============================
// Mi cuenta: Plan actual
// ===============================

(async () => {
  // 1) Supabase
  if (!window.NEBULA_PUBLIC?.SUPABASE_URL || !window.NEBULA_PUBLIC?.SUPABASE_ANON_KEY) {
    alert("Falta configuración de Supabase en /scripts/config.js");
    return;
  }
  const { createClient } = window.supabase;
  const supabase = createClient(
    window.NEBULA_PUBLIC.SUPABASE_URL,
    window.NEBULA_PUBLIC.SUPABASE_ANON_KEY
  );

  // Helpers DOM
  const $ = (sel) => document.querySelector(sel);
  const planPanel = $("#planPanel");
  const emailBox = $("#emailBox");
  const steamBox = $("#steamBox");
  const logoutBtn = $("#logoutBtn");

  // 2) Sesión
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    // no logueado -> a login
    window.location.href = "/login.html";
    return;
  }
  const email = (session.user.email || "").toLowerCase();
  emailBox.textContent = email;

  // (Opcional) muestra steam_user si lo guardas en profiles
  try {
    const { data: prof } = await supabase.from("profiles").select("steam_user").eq("email", email).maybeSingle();
    if (prof?.steam_user) {
      steamBox.textContent = `Steam: ${prof.steam_user}`;
    } else {
      steamBox.textContent = "Steam: —";
    }
  } catch {
    steamBox.textContent = "Steam: —";
  }

  // 3) Cargar plan actual desde la vista v_current_subscription
  try {
    const { data, error } = await supabase
      .from("v_current_subscription")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    renderPlan(data);
  } catch (err) {
    console.error(err);
    renderPlan(null);
  }

  // 4) Logout
  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };

  // ------------ UI ------------
  function renderPlan(row) {
    planPanel.innerHTML = "";

    if (!row) {
      const el = document.createElement("div");
      el.className = "card";
      el.style.background = "#0f172a";
      el.style.border = "1px dashed #243157";
      el.style.padding = "14px";
      el.innerHTML = `
        <div class="row" style="justify-content:space-between;">
          <div>
            <div class="h" style="margin:0 0 6px">Sin suscripción activa</div>
            <div class="muted">Elige un plan para comenzar.</div>
          </div>
          <a class="btn btn-brand" href="/pricing.html">Elegir plan</a>
        </div>
      `;
      planPanel.appendChild(el);
      return;
    }

    // Mapear estado a badge
    const { status, price_amount_decimal, price_currency, price_interval, product_name, cancel_at_period_end } = row;
    const amount = (price_amount_decimal ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const intervalTxt = intervalToEs(price_interval);
    const statusChip = statusChipEl(status);

    const renewText = (() => {
      const end = row.current_period_end ? new Date(row.current_period_end) : null;
      if (!end) return "";
      const dateStr = end.toLocaleDateString("es-MX", { day:"2-digit", month:"short", year:"numeric" });
      return cancel_at_period_end
        ? `Se cancelará el ${dateStr}`
        : `Se renueva el ${dateStr}`;
    })();

    const el = document.createElement("div");
    el.className = "card";
    el.style.background = "#0f172a";
    el.style.padding = "16px";
    el.innerHTML = `
      <div class="row" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="row" style="gap:12px;align-items:center;margin-bottom:6px">
            <div class="h" style="margin:0">${product_name ?? "Plan"}</div>
            ${statusChip}
          </div>
          <div class="row" style="gap:10px;align-items:baseline">
            <div class="price">${price_currency?.toUpperCase() ?? "MXN"} ${amount}</div>
            <div class="muted">/ ${intervalTxt}</div>
          </div>
          <div class="mini" style="margin-top:8px">${renewText}</div>
        </div>
        <div class="actions" style="align-self:flex-end">
          <a id="manageBtn" class="btn">Gestionar</a>
          <a class="btn" href="/pricing.html">Cambiar plan</a>
        </div>
      </div>
    `;
    planPanel.appendChild(el);

    // Botón "Gestionar" -> Portal de facturación (opcional)
    const manageBtn = el.querySelector("#manageBtn");
    manageBtn.onclick = async () => {
      try {
        const returnUrl = window.location.origin + "/dashboard.html";
        const res = await fetch(`/api/create-portal-session.js?return_url=${encodeURIComponent(returnUrl)}`, { method: "POST" });
        if (!res.ok) throw new Error("No se pudo crear la sesión de portal");
        const { url } = await res.json();
        window.location.href = url;
      } catch (e) {
        console.error(e);
        alert("No fue posible abrir el portal de facturación.");
      }
    };
  }

  function intervalToEs(iv) {
    switch ((iv || "month")) {
      case "day": return "día";
      case "week": return "semana";
      case "year": return "año";
      default: return "mes";
    }
  }

  function statusChipEl(status) {
    const span = document.createElement("span");
    span.className = "badge";
    const st = (status || "").toLowerCase();
    let txt = st;
    if (st === "active")       { span.classList.add("b-ok");   txt = "Activo"; }
    else if (st === "trialing"){ span.classList.add("b-ok");   txt = "Prueba"; }
    else if (st === "past_due"){ span.classList.add("b-warn"); txt = "Vencido"; }
    else if (st === "paused")  { span.classList.add("b-warn"); txt = "Pausado"; }
    else if (st === "canceled"){ span.classList.add("b-bad");  txt = "Cancelado"; }
    else                       { span.classList.add("b-warn"); txt = st || "—"; }
    span.textContent = txt;
    return span.outerHTML;
  }
})();
