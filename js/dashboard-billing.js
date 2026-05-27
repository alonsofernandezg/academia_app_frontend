(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para billing.");
  }

  const {
    authHeaders,
    getApiBase,
    renderStateBlock,
    resolveFileUrl,
    formatBirth,
    formatMoney,
    formatBillingType,
    getInvoiceStatusRank,
    formatInvoiceStatus,
    setStatusMessage,
    paginateList,
    showConfirmModal,
    showAlertModal,
  } = dashboardCommon;

  let generalPaymentsPage = 1;
  let generalPaymentsPerPage = 10;
  let generalPaymentsFiltersInit = false;
  let generalInvoicesCache = [];
  let generalPlansCache = [];
  let generalSubscriptionsCache = [];
  let billingPlansCache = [];
  let adminInvoicesCache = [];
  let billingReportCache = [];
  let editingInvoiceId = null;
  let editingPlanId = null;

  function getApiUrl() {
    return getApiBase();
  }

  function getCurrentMonthInputRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const paddedMonth = String(month).padStart(2, "0");
    return {
      start: `${year}-${paddedMonth}-01`,
      end: `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  function syncInvoicePeriodInputsForPlan(plan) {
    if (!plan || plan.billing_type !== "monthly") return;

    const startInput = document.getElementById("billInvoiceStart");
    const endInput = document.getElementById("billInvoiceEnd");
    if (!startInput || !endInput) return;

    const { start, end } = getCurrentMonthInputRange();
    startInput.value = start;
    endInput.value = end;
  }

  function updateBillingWorkspaceSummary(visibleInvoices = adminInvoicesCache) {
    if (!window.DashboardShell?.setWorkspaceModuleSummary) return;

    const pendingCount = visibleInvoices.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();
      return status === "pending" || status === "submitted";
    }).length;
    const activePlans = billingPlansCache.filter((plan) => plan.is_active).length;

    window.DashboardShell.setWorkspaceModuleSummary("admin", "billing", {
      metrics: [
        { label: "Facturas", value: String(visibleInvoices.length) },
        { label: "Pendientes", value: String(pendingCount) },
        { label: "Planes", value: String(activePlans) },
      ],
    });
  }

  function updateGeneralPaymentsWorkspaceSummary(filtered = generalInvoicesCache) {
    if (!window.DashboardShell?.setWorkspaceModuleSummary) return;

    const pendingCount = filtered.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();
      return status === "pending" || status === "submitted";
    }).length;
    const proofCount = filtered.filter((invoice) => Boolean(invoice.last_payment_proof_url)).length;

    window.DashboardShell.setWorkspaceModuleSummary("general", "payments", {
      metrics: [
        { label: "Pagos", value: String(filtered.length) },
        { label: "Pendientes", value: String(pendingCount) },
        { label: "Comprobantes", value: String(proofCount) },
      ],
    });
  }

  function getRoleName() {
    return window.role || localStorage.getItem("role") || "general";
  }

  function getGeneralPaymentsFilters() {
    const searchEl = document.getElementById("generalPaymentsSearch");
    const statusEl = document.getElementById("generalPaymentsStatus");
    return {
      search: (searchEl ? searchEl.value : "").trim().toLowerCase(),
      status: statusEl ? statusEl.value : "",
    };
  }

  function applyGeneralPaymentsFilters(items, filters) {
    return items.filter((invoice) => {
      if (filters.status && invoice.status !== filters.status) return false;
      if (filters.search) {
        const haystack = `${invoice.athlete_name || ""} ${invoice.plan_name || ""}`.toLowerCase();
        if (!haystack.includes(filters.search)) return false;
      }
      return true;
    });
  }

  function initGeneralPaymentsFilters() {
    const searchEl = document.getElementById("generalPaymentsSearch");
    const statusEl = document.getElementById("generalPaymentsStatus");
    const perPageEl = document.getElementById("generalPaymentsPerPage");
    const prevBtn = document.getElementById("generalPaymentsPrev");
    const nextBtn = document.getElementById("generalPaymentsNext");

    if (perPageEl) perPageEl.value = String(generalPaymentsPerPage);

    const onChange = () => {
      generalPaymentsPage = 1;
      renderGeneralPayments();
    };

    if (searchEl) searchEl.addEventListener("input", onChange);
    if (statusEl) statusEl.addEventListener("change", onChange);
    if (perPageEl) {
      perPageEl.addEventListener("change", () => {
        const value = Number(perPageEl.value || 10);
        generalPaymentsPerPage = Number.isNaN(value) ? 10 : value;
        generalPaymentsPage = 1;
        renderGeneralPayments();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (generalPaymentsPage > 1) {
          generalPaymentsPage -= 1;
          renderGeneralPayments();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        generalPaymentsPage += 1;
        renderGeneralPayments();
      });
    }

    generalPaymentsFiltersInit = true;
  }

  async function loadGeneralPayments() {
    const box = document.getElementById("generalPaymentsList");
    if (!box) return;

    box.innerHTML = renderStateBlock(
      "loading",
      "Estamos reuniendo tus pagos",
      "Verás estado, periodo y comprobantes en una sola vista."
    );

    try {
      const cfgRes = await fetch(`${getApiUrl()}/auth/config`);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        const btn = document.getElementById("compraClickBtn");
        if (btn && cfg.compraclick_url) {
          btn.href = cfg.compraclick_url;
          btn.style.display = "inline-block";
        }
      }
    } catch (_) {
      // Non-critical config fetch.
    }

    try {
      const res = await fetch(`${getApiUrl()}/billing/invoices/my`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los pagos");
      generalInvoicesCache = data;
      if (!generalPaymentsFiltersInit) {
        initGeneralPaymentsFilters();
      }
      renderGeneralPayments();
    } catch (error) {
      box.innerHTML = renderStateBlock(
        "error",
        "No pudimos cargar tus pagos",
        error.message || "Intenta actualizar esta vista en unos segundos."
      );
    }
  }

  function renderGeneralPayments() {
    const box = document.getElementById("generalPaymentsList");
    if (!box) return;

    if (!generalInvoicesCache.length) {
      updateGeneralPaymentsWorkspaceSummary([]);
      box.innerHTML = renderStateBlock(
        "empty",
        "Todavía no hay pagos registrados",
        "Cuando tengas facturas activas podrás seguir aquí su estado y comprobantes."
      );
      return;
    }

    const filters = getGeneralPaymentsFilters();
    const filtered = applyGeneralPaymentsFilters(generalInvoicesCache, filters);
    updateGeneralPaymentsWorkspaceSummary(filtered);
    if (!filtered.length) {
      const pageInfo = document.getElementById("generalPaymentsPageInfo");
      const prevBtn = document.getElementById("generalPaymentsPrev");
      const nextBtn = document.getElementById("generalPaymentsNext");
      if (pageInfo) pageInfo.textContent = "P\u00e1gina 0 de 0";
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      box.innerHTML = renderStateBlock(
        "empty",
        "No encontramos pagos con esos filtros",
        "Prueba con otro estado o término de búsqueda para ampliar la lista."
      );
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      const rank = getInvoiceStatusRank(a.status) - getInvoiceStatusRank(b.status);
      if (rank !== 0) return rank;
      const aDate = a.period_start ? new Date(a.period_start).getTime() : 0;
      const bDate = b.period_start ? new Date(b.period_start).getTime() : 0;
      return bDate - aDate;
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / generalPaymentsPerPage));
    if (generalPaymentsPage > totalPages) generalPaymentsPage = totalPages;
    const start = (generalPaymentsPage - 1) * generalPaymentsPerPage;
    const pageItems = sorted.slice(start, start + generalPaymentsPerPage);

    const pageInfo = document.getElementById("generalPaymentsPageInfo");
    const prevBtn = document.getElementById("generalPaymentsPrev");
    const nextBtn = document.getElementById("generalPaymentsNext");
    if (pageInfo) pageInfo.textContent = `P\u00e1gina ${generalPaymentsPage} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = generalPaymentsPage <= 1;
    if (nextBtn) nextBtn.disabled = generalPaymentsPage >= totalPages;

    box.innerHTML = pageItems
      .map((invoice) => {
        const periodStart = invoice.period_start ? formatBirth(invoice.period_start) : "-";
        const periodEnd = invoice.period_end ? formatBirth(invoice.period_end) : "-";
        const periodText =
          invoice.period_start || invoice.period_end ? `${periodStart} - ${periodEnd}` : "Sin periodo";
        const statusClass =
          invoice.status === "paid"
            ? "w3-text-green"
            : invoice.status === "submitted"
            ? "w3-text-orange"
            : "w3-text-gray";
        const proofLink = invoice.last_payment_proof_url
          ? `<div class="w3-small w3-text-gray">
              Ultimo comprobante:
              <a href="${resolveFileUrl(invoice.last_payment_proof_url)}" target="_blank">Ver</a>
            </div>`
          : "";
        return `
        <div class="w3-card w3-round-xxlarge w3-padding-small w3-margin-bottom">
          <div class="w3-row">
            <div class="w3-col s12 m8 w3-padding-small">
              <b>${invoice.athlete_name || "-"}</b><br>
              <span class="w3-small w3-text-gray">
                Plan: ${invoice.plan_name || "Manual"}${invoice.billing_type ? " (" + formatBillingType(invoice.billing_type) + ")" : ""}
              </span><br>
              ${invoice.callup_id ? `<span class="w3-small w3-text-blue" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px" onclick="window.location.hash='#callups';setTimeout(()=>window.DashboardCallups.loadCallupDetail(${invoice.callup_id}),200)"><span class="ui-icon ui-icon--brand" aria-hidden="true">assignment</span><span>Convocatoria: ${invoice.callup_title || "Ver"}</span></span><br>` : ""}
              <span class="w3-small w3-text-gray">Periodo: ${periodText}</span><br>
              <span class="w3-small w3-text-gray">Monto: ${formatMoney(invoice.total_amount, invoice.currency)}</span><br>
              <span class="w3-small ${statusClass}">Estado: ${formatInvoiceStatus(invoice.status)}</span>
              ${proofLink}
            </div>
            <div class="w3-col s12 m4 w3-right-align w3-padding-small">
              ${invoice.status !== "paid" && invoice.status !== "cancelled" ? `
              <button
                class="w3-button w3-blue w3-round-xxlarge w3-small"
                onclick="window.DashboardBilling.openPaymentProof(${invoice.id})">
                Subir comprobante
              </button>
              ` : ""}
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  async function loadGeneralPlans() {
    const select = document.getElementById("generalPlanSelect");
    if (!select) return;
    select.innerHTML = `<option value="">Cargando planes...</option>`;
    try {
      const res = await fetch(`${getApiUrl()}/billing/plans/public`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los planes");
      generalPlansCache = data;
      renderGeneralPlanSelect();
    } catch (error) {
      select.innerHTML = `<option value="">Error cargando planes</option>`;
    }
  }

  function renderGeneralPlanSelect() {
    const select = document.getElementById("generalPlanSelect");
    if (!select) return;
    if (!generalPlansCache.length) {
      select.innerHTML = `<option value="">No hay planes disponibles</option>`;
      return;
    }
    select.innerHTML =
      `<option value="">Seleccione un plan...</option>` +
      generalPlansCache
        .map(
          (plan) =>
            `<option value="${plan.id}">${plan.name} - ${formatMoney(plan.amount, plan.currency)} (${formatBillingType(plan.billing_type)})</option>`
        )
        .join("");
  }

  function fillGeneralPlanAthleteSelect(athletes = []) {
    const select = document.getElementById("generalPlanAthlete");
    if (!select) return;
    if (!athletes.length) {
      select.innerHTML = `<option value="">No hay atletas</option>`;
      return;
    }
    select.innerHTML =
      `<option value="">Seleccione un atleta...</option>` +
      athletes
        .map((athlete) => `<option value="${athlete.id}">${athlete.first_name} ${athlete.last_name}</option>`)
        .join("");
  }

  async function loadGeneralSubscriptions() {
    const box = document.getElementById("generalPlanStatusList");
    if (!box) return;
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando planes...</div>`;
    try {
      const res = await fetch(`${getApiUrl()}/billing/subscriptions/my`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los planes");
      generalSubscriptionsCache = data;
      renderGeneralSubscriptions();
    } catch (error) {
      box.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  function renderGeneralSubscriptions() {
    const box = document.getElementById("generalPlanStatusList");
    if (!box) return;
    if (!generalSubscriptionsCache.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No tienes planes seleccionados.</div>`;
      return;
    }

    const byAthlete = new Map();
    generalSubscriptionsCache.forEach((subscription) => {
      const key = String(subscription.athlete_id);
      if (!byAthlete.has(key)) {
        byAthlete.set(key, {
          athleteName: subscription.athlete_name,
          active: null,
          scheduled: null,
        });
      }
      const entry = byAthlete.get(key);
      if (subscription.status === "active") {
        entry.active = subscription;
      } else if (subscription.status === "scheduled") {
        entry.scheduled = subscription;
      }
    });

    box.innerHTML = Array.from(byAthlete.values())
      .map((row) => {
        const active = row.active;
        const scheduled = row.scheduled;
        const activeText = active
          ? `${active.plan_name} (${formatBillingType(active.billing_type)}) - Desde ${formatBirth(active.start_date)}`
          : "Sin plan activo";
        const scheduledText = scheduled
          ? `${scheduled.plan_name} (${formatBillingType(scheduled.billing_type)}) - Desde ${formatBirth(scheduled.start_date)}`
          : "Sin cambio programado";
        const perClassNote =
          (active && active.billing_type === "per_class") ||
          (scheduled && scheduled.billing_type === "per_class")
            ? `<div class="w3-small w3-text-gray">Por clase: se factura cuando el admin registra la clase.</div>`
            : "";
        return `
        <div class="w3-padding-small w3-border-bottom">
          <div><b>${row.athleteName}</b></div>
          <div class="w3-small w3-text-gray">Activo: ${activeText}</div>
          <div class="w3-small w3-text-gray">Programado: ${scheduledText}</div>
          ${perClassNote}
        </div>
        `;
      })
      .join("");
  }

  async function selectAthletePlan() {
    const athleteId = document.getElementById("generalPlanAthlete").value;
    const planId = document.getElementById("generalPlanSelect").value;
    const msg = document.getElementById("generalPlanMsg");
    if (msg) msg.textContent = "";

    if (!athleteId || !planId) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = "Selecciona un atleta y un plan.";
      }
      return;
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/billing/subscriptions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ athlete_id: Number(athleteId), plan_id: Number(planId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo seleccionar el plan");
      const startText = data.start_date ? formatBirth(data.start_date) : "-";
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent =
        data.status === "scheduled"
          ? `Plan programado para iniciar el ${startText}.`
          : `Plan activo desde ${startText}.`;
      await loadGeneralSubscriptions();
      await loadGeneralPayments();
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  function openPaymentProof(invoiceId) {
    const modal = document.getElementById("modalPaymentProof");
    const msg = document.getElementById("paymentMsg");
    const fileInput = document.getElementById("paymentProofFile");
    const amountInput = document.getElementById("paymentAmount");
    const methodInput = document.getElementById("paymentMethod");
    const summary = document.getElementById("paymentInvoiceSummary");
    if (!modal || !amountInput || !summary) return;

    const invoice = generalInvoicesCache.find((item) => item.id === invoiceId);
    if (!invoice) return;

    document.getElementById("paymentInvoiceId").value = invoiceId;
    amountInput.value = invoice.total_amount || "";
    if (methodInput) methodInput.value = "transfer";
    if (fileInput) fileInput.value = "";
    if (msg) msg.textContent = "";
    syncPaymentProofRequirement();

    summary.textContent = `${invoice.athlete_name || "-"} - ${formatMoney(
      invoice.total_amount,
      invoice.currency
    )}`;

    modal.style.display = "block";
  }

  function closePaymentProof() {
    const modal = document.getElementById("modalPaymentProof");
    if (modal) modal.style.display = "none";
  }

  function syncPaymentProofRequirement() {
    const methodInput = document.getElementById("paymentMethod");
    const fileInput = document.getElementById("paymentProofFile");
    const label = document.getElementById("paymentProofLabel");
    const note = document.getElementById("paymentProofNote");
    if (!methodInput || !fileInput || !label || !note) return;

    const requiresProof = methodInput.value !== "cash";
    label.textContent = requiresProof
      ? "Comprobante (imagen o PDF)"
      : "Comprobante (opcional para efectivo)";
    note.textContent = requiresProof
      ? "Para transferencia seguimos requiriendo el comprobante."
      : "Si registras pago en efectivo, puedes enviarlo sin adjuntar archivo.";
    fileInput.required = requiresProof;
  }

  async function submitPaymentProof() {
    const invoiceId = document.getElementById("paymentInvoiceId").value;
    const amount = document.getElementById("paymentAmount").value;
    const method = document.getElementById("paymentMethod").value;
    const file = document.getElementById("paymentProofFile").files[0];
    const msg = document.getElementById("paymentMsg");
    if (msg) msg.textContent = "";

    if (!invoiceId) return;
    if (method !== "cash" && !file) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = "Debes adjuntar el comprobante.";
      }
      return;
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const formData = new FormData();
      if (amount) formData.append("amount", amount);
      formData.append("method", method);
      if (file) formData.append("file", file);

      const currentToken = localStorage.getItem("token");
      const res = await fetch(`${getApiUrl()}/billing/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { Authorization: "Bearer " + currentToken },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo enviar el comprobante");

      if (msg) {
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = method === "cash"
          ? "Pago en efectivo registrado correctamente."
          : "Comprobante enviado correctamente.";
      }
      await loadGeneralPayments();
      setTimeout(closePaymentProof, 800);
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  async function loadAdminBilling() {
    const planSelect = document.getElementById("billInvoicePlan");
    const searchInput = document.getElementById("billInvoiceSearch");
    const statusSelect = document.getElementById("billInvoiceStatus");
    const planCancelBtn = document.getElementById("billPlanCancelBtn");
    if (planSelect) {
      planSelect.onchange = () => {
        const planId = planSelect.value;
        if (!planId) return;
        const plan = billingPlansCache.find((item) => String(item.id) === String(planId));
        const amountInput = document.getElementById("billInvoiceAmount");
        if (plan && amountInput) {
          amountInput.value = plan.amount;
        }
        syncInvoicePeriodInputsForPlan(plan);
      };
    }
    if (searchInput) searchInput.addEventListener("input", renderAdminInvoices);
    if (statusSelect) statusSelect.addEventListener("change", renderAdminInvoices);
    if (planCancelBtn) planCancelBtn.onclick = cancelEditBillingPlan;

    await loadBillingPlans();
    await loadAdminAthleteOptions();
    await loadAdminInvoices();
  }

  async function loadBillingPlans() {
    const list = document.getElementById("billPlanList");
    const planSelect = document.getElementById("billInvoicePlan");
    if (!list || !planSelect) return;

    list.innerHTML = renderStateBlock(
      "loading",
      "Estamos actualizando los planes",
      "Preparamos los montos activos y las opciones disponibles para facturación."
    );
    try {
      const res = await fetch(`${getApiUrl()}/billing/plans?active_only=false`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los planes");
      billingPlansCache = data;
      renderBillingPlans();
    } catch (error) {
      list.innerHTML = renderStateBlock(
        "error",
        "No pudimos cargar los planes",
        error.message || "Intenta actualizar esta sección en unos segundos."
      );
    }
  }

  function renderBillingPlans() {
    const list = document.getElementById("billPlanList");
    const planSelect = document.getElementById("billInvoicePlan");
    if (!list || !planSelect) return;

    if (!billingPlansCache.length) {
      list.innerHTML = renderStateBlock(
        "empty",
        "Todavía no hay planes creados",
        "Configura el primer plan para agilizar la generación de facturas y reportes."
      );
      planSelect.innerHTML = `<option value="">Manual</option>`;
      updateBillingWorkspaceSummary();
      return;
    }

    list.innerHTML = billingPlansCache
      .map((plan) => {
        const statusText = plan.is_active ? "Activo" : "Inactivo";
        const statusClass = plan.is_active ? "w3-text-green" : "w3-text-gray";
        const toggleText = plan.is_active ? "Inactivar" : "Activar";
        return `
        <div class="w3-padding-small w3-border-bottom">
          <div>
            <span class="w3-tag w3-round-xxlarge w3-light-gray">${plan.name}</span>
            <span class="w3-small w3-text-gray" style="margin-left:6px">${formatMoney(plan.amount, plan.currency)}</span>
          </div>
          <div class="w3-small w3-text-gray">${formatBillingType(plan.billing_type)}</div>
          <div class="w3-small ${statusClass}">${statusText}</div>
          <div class="w3-small w3-margin-top">
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
              onclick='openEditBillingPlan(${JSON.stringify(plan)})'>
              Editar
            </button>
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
              onclick="window.DashboardBilling.toggleBillingPlanStatus(${plan.id}, ${!plan.is_active})">
              ${toggleText}
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    planSelect.innerHTML =
      `<option value="">Manual</option>` +
      billingPlansCache
        .filter((plan) => plan.is_active)
        .map((plan) => `<option value="${plan.id}">${plan.name}</option>`)
        .join("");

    updateBillingWorkspaceSummary();
  }

  async function loadAdminAthleteOptions() {
    const select = document.getElementById("billInvoiceAthlete");
    if (!select) return;

    try {
      const url =
        getRoleName() === "admin"
          ? `${getApiUrl()}/athletes/my?include_inactive=true`
          : `${getApiUrl()}/athletes/my`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los atletas");

      const options = data
        .map((athlete) => `<option value="${athlete.id}">${athlete.first_name} ${athlete.last_name}</option>`)
        .join("");
      select.innerHTML = `<option value="">Seleccione un atleta...</option>` + options;
    } catch (error) {
      select.innerHTML = `<option value="">Error cargando atletas</option>`;
    }
  }

  async function createBillingPlan() {
    const name = document.getElementById("billPlanName").value.trim();
    const amount = document.getElementById("billPlanAmount").value;
    const billingType = document.getElementById("billPlanType").value;
    const msg = document.getElementById("billPlanMsg");
    if (msg) msg.textContent = "";

    if (!name || !amount) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = "Nombre y monto son obligatorios.";
      }
      return;
    }

    try {
      setStatusMessage(msg, "Guardando cambios...", "w3-small w3-text-gray w3-center");
      const isEdit = Boolean(editingPlanId);
      const url = isEdit ? `${getApiUrl()}/billing/plans/${editingPlanId}` : `${getApiUrl()}/billing/plans`;
      const method = isEdit ? "PATCH" : "POST";
      const payload = {
        name,
        amount: Number(amount),
        currency: "CRC",
        billing_type: billingType,
      };
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo guardar el plan");
      if (msg) {
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = isEdit ? "Plan actualizado correctamente." : "Plan listo para usarse en nuevas facturas.";
      }
      cancelEditBillingPlan();
      await loadBillingPlans();
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  function openEditBillingPlan(plan) {
    editingPlanId = plan.id;
    document.getElementById("billPlanName").value = plan.name || "";
    document.getElementById("billPlanAmount").value = plan.amount || "";
    document.getElementById("billPlanType").value = plan.billing_type || "monthly";
    const btn = document.getElementById("billPlanCreateBtn");
    const cancelBtn = document.getElementById("billPlanCancelBtn");
    const msg = document.getElementById("billPlanMsg");
    if (btn) btn.textContent = "Actualizar plan";
    if (cancelBtn) cancelBtn.style.display = "inline-block";
    if (msg) msg.textContent = "";
  }

  function cancelEditBillingPlan() {
    editingPlanId = null;
    document.getElementById("billPlanName").value = "";
    document.getElementById("billPlanAmount").value = "";
    document.getElementById("billPlanType").value = "monthly";
    const btn = document.getElementById("billPlanCreateBtn");
    const cancelBtn = document.getElementById("billPlanCancelBtn");
    if (btn) btn.textContent = "Guardar plan";
    if (cancelBtn) cancelBtn.style.display = "none";
  }

  async function toggleBillingPlanStatus(planId, isActive) {
    const action = isActive ? "activar" : "inactivar";
    const ok = await showConfirmModal(`\u00bfDeseas ${action} este plan?`);
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/billing/plans/${planId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el plan");
      await loadBillingPlans();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function createBillingInvoice() {
    const athleteId = document.getElementById("billInvoiceAthlete").value;
    const planId = document.getElementById("billInvoicePlan").value;
    const start = document.getElementById("billInvoiceStart").value || null;
    const end = document.getElementById("billInvoiceEnd").value || null;
    const amount = document.getElementById("billInvoiceAmount").value;
    const notes = document.getElementById("billInvoiceNotes").value.trim();
    const msg = document.getElementById("billInvoiceMsg");
    if (msg) msg.textContent = "";

    if (!athleteId || !amount) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = "Atleta y monto son obligatorios.";
      }
      return;
    }

    const payload = {
      total_amount: Number(amount),
    };
    if (!editingInvoiceId) {
      payload.athlete_id = Number(athleteId);
    }
    if (planId) payload.plan_id = Number(planId);
    if (start) payload.period_start = start;
    if (end) payload.period_end = end;
    if (notes) payload.notes = notes;

    try {
      setStatusMessage(msg, "Guardando cambios...", "w3-small w3-text-gray w3-center");
      const url = editingInvoiceId
        ? `${getApiUrl()}/billing/invoices/${editingInvoiceId}`
        : `${getApiUrl()}/billing/invoices`;
      const method = editingInvoiceId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo crear la factura");
      if (msg) {
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = editingInvoiceId
          ? "Factura actualizada correctamente."
          : "Factura creada y lista para seguimiento.";
      }
      resetInvoiceForm();
      await loadAdminInvoices();
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  function openEditInvoice(invoice) {
    editingInvoiceId = invoice.id;
    document.getElementById("billInvoiceAthlete").value = String(invoice.athlete_id || "");
    document.getElementById("billInvoicePlan").value = invoice.plan_id ? String(invoice.plan_id) : "";
    document.getElementById("billInvoiceStart").value = invoice.period_start || "";
    document.getElementById("billInvoiceEnd").value = invoice.period_end || "";
    document.getElementById("billInvoiceAmount").value = invoice.total_amount || "";
    document.getElementById("billInvoiceNotes").value = invoice.notes || "";
    const msg = document.getElementById("billInvoiceMsg");
    if (msg) msg.textContent = "";
  }

  function resetInvoiceForm() {
    editingInvoiceId = null;
    document.getElementById("billInvoiceStart").value = "";
    document.getElementById("billInvoiceEnd").value = "";
    document.getElementById("billInvoiceAmount").value = "";
    document.getElementById("billInvoiceNotes").value = "";
  }

  async function loadAdminInvoices() {
    const box = document.getElementById("billInvoiceList");
    if (!box) return;

    box.innerHTML = renderStateBlock(
      "loading",
      "Estamos reuniendo las facturas",
      "Incluimos estado, plan y acciones rápidas para revisar el periodo."
    );
    try {
      const res = await fetch(`${getApiUrl()}/billing/invoices`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar las facturas");
      adminInvoicesCache = data;
      renderAdminInvoices();
    } catch (error) {
      box.innerHTML = renderStateBlock(
        "error",
        "No pudimos cargar las facturas",
        error.message || "Intenta actualizar esta sección nuevamente."
      );
    }
  }

  function renderAdminInvoices() {
    const box = document.getElementById("billInvoiceList");
    if (!box) return;

    const search = (document.getElementById("billInvoiceSearch")?.value || "")
      .trim()
      .toLowerCase();
    const status = document.getElementById("billInvoiceStatus")?.value || "";

    const filtered = adminInvoicesCache.filter((invoice) => {
      if (status && invoice.status !== status) return false;
      if (!search) return true;
      const athlete = (invoice.athlete_name || "").toLowerCase();
      const plan = (invoice.plan_name || "").toLowerCase();
      return athlete.includes(search) || plan.includes(search);
    });

    updateBillingWorkspaceSummary(filtered);

    if (!filtered.length) {
      box.innerHTML = renderStateBlock(
        "empty",
        search || status ? "No encontramos facturas con esos filtros" : "Todavía no hay facturas generadas",
        search || status
          ? "Prueba con otro nombre, plan o estado para ampliar la búsqueda."
          : "Genera el primer lote mensual o crea una factura manual para empezar."
      );
      return;
    }

    const pageItems = paginateList(filtered, "adminInvoices", "billInvoiceList", renderAdminInvoices);

    box.innerHTML = pageItems
      .map((invoice) => {
        const periodStart = invoice.period_start ? formatBirth(invoice.period_start) : "-";
        const periodEnd = invoice.period_end ? formatBirth(invoice.period_end) : "-";
        const periodText =
          invoice.period_start || invoice.period_end ? `${periodStart} - ${periodEnd}` : "Sin periodo";
        const statusClass =
          invoice.status === "paid"
            ? "w3-text-green"
            : invoice.status === "submitted"
            ? "w3-text-orange"
            : "w3-text-gray";
        const proofLink = invoice.last_payment_proof_url
          ? `<div class="w3-small w3-text-gray">
              Comprobante:
              <a href="${resolveFileUrl(invoice.last_payment_proof_url)}" target="_blank">Ver</a>
            </div>`
          : "";
        const markPaidButton =
          invoice.status !== "paid"
            ? `<button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-top"
                onclick="window.DashboardBilling.markInvoicePaid(${invoice.id})">
                Marcar pagada
              </button>`
            : "";
        const cancelButton =
          invoice.status !== "cancelled"
            ? `<button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-top w3-margin-left"
                onclick="window.DashboardBilling.cancelInvoice(${invoice.id})">
                Cancelar
              </button>`
            : "";
        const editButton = `<button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-top w3-margin-left"
                onclick='openEditInvoice(${JSON.stringify(invoice)})'>
                Editar
              </button>`;
        return `
        <div class="w3-padding-small w3-border-bottom">
          <b>${invoice.athlete_name || "-"}</b><br>
          <span class="w3-small w3-text-gray">
            Plan: ${invoice.plan_name || "Manual"}${invoice.billing_type ? " (" + formatBillingType(invoice.billing_type) + ")" : ""}
          </span><br>
              ${invoice.callup_id ? `<span class="w3-small w3-text-blue" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px" onclick="window.location.hash='#callups';setTimeout(()=>window.DashboardCallups.loadCallupDetail(${invoice.callup_id}),200)"><span class="ui-icon ui-icon--brand" aria-hidden="true">assignment</span><span>Convocatoria: ${invoice.callup_title || "Ver"}</span></span><br>` : ""}
          <span class="w3-small w3-text-gray">Periodo: ${periodText}</span><br>
          <span class="w3-small w3-text-gray">Monto: ${formatMoney(invoice.total_amount, invoice.currency)}</span><br>
          <span class="w3-small ${statusClass}">Estado: ${formatInvoiceStatus(invoice.status)}</span>
          ${proofLink}
          ${markPaidButton}
          ${cancelButton}
          ${editButton}
        </div>
      `;
      })
      .join("");
  }

  async function markInvoicePaid(invoiceId) {
    const ok = await showConfirmModal("\u00bfMarcar esta factura como pagada?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/billing/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: "paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar la factura");
      await loadAdminInvoices();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function cancelInvoice(invoiceId) {
    const ok = await showConfirmModal("\u00bfCancelar esta factura?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/billing/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo cancelar la factura");
      await loadAdminInvoices();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function loadBillingReport() {
    const monthInput = document.getElementById("billingReportMonth");
    const box = document.getElementById("billingReportList");
    if (!monthInput || !box) return;

    const month = monthInput.value;
    if (!month) {
      box.innerHTML = renderStateBlock(
        "empty",
        "Elige un mes para ver el resumen",
        "Desde aquí también podrás exportar el reporte o generar nuevas facturas."
      );
      return;
    }

    box.innerHTML = renderStateBlock(
      "loading",
      "Estamos preparando el reporte mensual",
      "Calculamos estado, periodo y monto para que lo revises en una sola vista."
    );
    try {
      const res = await fetch(`${getApiUrl()}/billing/report?month=${month}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte");
      billingReportCache = data;
      if (!data.length) {
        box.innerHTML = renderStateBlock(
          "empty",
          "Todavía no hay movimientos para ese mes",
          "Prueba con otro periodo o genera las facturas pendientes antes de exportar."
        );
        return;
      }
      box.innerHTML = renderBillingReportResults(data, getBillingReportContainerWidth(box));
    } catch (error) {
      box.innerHTML = renderStateBlock(
        "error",
        "No pudimos generar el reporte",
        error.message || "Intenta nuevamente con el mismo mes en unos segundos."
      );
    }
  }

  async function generateMonthlyInvoices() {
    const monthInput = document.getElementById("billingReportMonth");
    const msgBox = document.getElementById("billingReportList");
    if (!monthInput) return;
    const month = monthInput.value;
    if (!month) {
      if (msgBox) {
        msgBox.innerHTML = renderStateBlock(
          "empty",
          "Elige un mes antes de generar facturas",
          "Así evitamos crear movimientos fuera del periodo que quieres revisar."
        );
      }
      return;
    }
    const ok = await showConfirmModal("\u00bfGenerar facturas para este mes?");
    if (!ok) return;
    try {
      if (msgBox) {
        msgBox.innerHTML = renderStateBlock(
          "loading",
          "Estamos generando las facturas del mes",
          "En cuanto termine podrás revisarlas y exportar el resumen actualizado."
        );
      }
      const res = await fetch(`${getApiUrl()}/billing/subscriptions/generate-monthly?month=${month}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron generar las facturas");
      if (msgBox) {
        msgBox.innerHTML = renderStateBlock(
          "success",
          "Facturas generadas correctamente",
          `${data.created || 0} factura(s) quedaron listas para revisar o exportar.`
        );
      }
      await loadAdminInvoices();
    } catch (error) {
      if (msgBox) {
        msgBox.innerHTML = renderStateBlock(
          "error",
          "No pudimos generar las facturas",
          error.message || "Intenta nuevamente con el mismo mes."
        );
      }
    }
  }

  async function fixInvoicePeriods() {
    const ok = await showConfirmModal(
      "\u00bfCorregir todas las fechas de per\u00edodo? Las facturas con fechas incorrectas se normalizar\u00e1n al primer y \u00faltimo d\u00eda de su mes."
    );
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/billing/invoices/fix-periods`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      showAlertModal(data.message || `${data.fixed} factura(s) corregida(s).`);
      await loadAdminInvoices();
    } catch (error) {
      showAlertModal(`Error: ${error.message}`);
    }
  }

  function formatBillingReportPeriod(row) {
    const periodStart = row.period_start ? formatBirth(row.period_start) : "-";
    const periodEnd = row.period_end ? formatBirth(row.period_end) : "-";
    return row.period_start || row.period_end ? `${periodStart} - ${periodEnd}` : "Sin periodo";
  }

  function getBillingReportStatusClass(status) {
    switch (String(status || "").toLowerCase()) {
      case "paid":
        return "billing-report-card-status--paid";
      case "submitted":
        return "billing-report-card-status--submitted";
      case "cancelled":
        return "billing-report-card-status--cancelled";
      default:
        return "billing-report-card-status--pending";
    }
  }

  function getBillingReportContainerWidth(box) {
    if (!box) return window.innerWidth || 0;
    return box.clientWidth || box.parentElement?.clientWidth || window.innerWidth || 0;
  }

  function shouldUseBillingReportCards(containerWidth) {
    return Number(containerWidth || 0) < 620;
  }

  function rerenderBillingReport() {
    const box = document.getElementById("billingReportList");
    if (!box || !billingReportCache.length) return;
    box.innerHTML = renderBillingReportResults(billingReportCache, getBillingReportContainerWidth(box));
  }

  function renderBillingReportResults(rows, containerWidth) {
    return shouldUseBillingReportCards(containerWidth)
      ? `<div class="billing-report-results"><div class="billing-report-cards">${renderBillingReportCards(rows)}</div></div>`
      : `<div class="billing-report-results"><div class="billing-report-table table-scroll">${renderBillingReportTable(rows)}</div></div>`;
  }

  function renderBillingReportCards(rows) {
    return rows
      .map((row) => {
        const periodText = formatBillingReportPeriod(row);
        return `
          <article class="billing-report-card">
            <div class="billing-report-card-head">
              <div>
                <div class="billing-report-card-number">Factura #${row.invoice_id}</div>
                <h5 class="billing-report-card-title">${row.athlete_name || "-"}</h5>
              </div>
              <span class="billing-report-card-status ${getBillingReportStatusClass(row.status)}">${formatInvoiceStatus(row.status)}</span>
            </div>
            <dl class="billing-report-card-meta">
              <div>
                <dt>Plan</dt>
                <dd>${row.plan_name || "Manual"}</dd>
              </div>
              <div>
                <dt>Periodo</dt>
                <dd>${periodText}</dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>${formatMoney(row.total_amount, row.currency)}</dd>
              </div>
            </dl>
          </article>
        `;
      })
      .join("");
  }

  function renderBillingReportTable(rows) {
    const header = `
      <table class="w3-table-all w3-small w3-round-xxlarge">
        <thead>
          <tr class="w3-light-gray">
            <th>Factura</th>
            <th>Deportista</th>
            <th>Plan</th>
            <th>Periodo</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
    `;
    const body = rows
      .map((row) => {
        const periodText = formatBillingReportPeriod(row);
        return `
        <tr>
          <td>${row.invoice_id}</td>
          <td>${row.athlete_name || "-"}</td>
          <td>${row.plan_name || "Manual"}</td>
          <td>${periodText}</td>
          <td>${formatMoney(row.total_amount, row.currency)}</td>
          <td>${formatInvoiceStatus(row.status)}</td>
        </tr>
      `;
      })
      .join("");
    return `${header}${body}</tbody></table>`;
  }

  function exportBillingCsv() {
    if (!billingReportCache.length) {
      showAlertModal("No hay datos para exportar.");
      return;
    }
    const header = ["Factura", "Deportista", "Plan", "Periodo", "Monto", "Estado"];
    const rows = billingReportCache.map((row) => {
      const periodStart = row.period_start || "";
      const periodEnd = row.period_end || "";
      const periodText = periodStart || periodEnd ? `${periodStart} - ${periodEnd}` : "";
      return [
        row.invoice_id,
        row.athlete_name || "",
        row.plan_name || "Manual",
        periodText,
        `${row.total_amount} ${row.currency}`,
        formatInvoiceStatus(row.status),
      ];
    });

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const month = document.getElementById("billingReportMonth")?.value || "mes";
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_facturacion_${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportBillingPdf() {
    const box = document.getElementById("billingReportList");
    if (!box || !billingReportCache.length) {
      showAlertModal("No hay datos para exportar.");
      return;
    }

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Reporte de facturacion</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #f1f1f1; }
          </style>
        </head>
        <body>
          <h3>Reporte de facturacion</h3>
          ${renderBillingReportTable(billingReportCache)}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  window.addEventListener("resize", rerenderBillingReport);

  window.DashboardBilling = {
    fillGeneralPlanAthleteSelect,
    loadGeneralPayments,
    loadGeneralPlans,
    loadGeneralSubscriptions,
    selectAthletePlan,
    openPaymentProof,
    closePaymentProof,
    syncPaymentProofRequirement,
    submitPaymentProof,
    loadAdminBilling,
    createBillingPlan,
    openEditBillingPlan,
    cancelEditBillingPlan,
    toggleBillingPlanStatus,
    createBillingInvoice,
    openEditInvoice,
    loadAdminInvoices,
    markInvoicePaid,
    cancelInvoice,
    loadBillingReport,
    generateMonthlyInvoices,
    fixInvoicePeriods,
    exportBillingCsv,
    exportBillingPdf,
  };
})();