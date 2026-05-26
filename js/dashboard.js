const API_URL = (() => {
  const defaultBase = "http://127.0.0.1:8000";
  const rawBase = String(window.API_BASE || defaultBase).trim().replace(/\/+$/, "");
  if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
    return `https://${rawBase.slice(7)}`;
  }
  return rawBase;
})();
window.API_BASE = API_URL;

const token = localStorage.getItem("token");
const role = localStorage.getItem("role") || "general";
window.role = role;

if (!token) window.location.href = "index.html";

// --------------------------------------------------
// Helpers generales
// --------------------------------------------------

let activeDashboardModule = null;
const dashboardModuleLoadState = {
  admin: {},
  general: {},
  coach: {},
};

const DASHBOARD_WORKSPACE_CONFIG = {
  admin: {
    defaultModule: "users",
    titleId: "adminWorkspaceTitle",
    descriptionId: "adminWorkspaceDescription",
    modules: {
      users: {
        title: "Usuarios y accesos",
        description: "Gestiona cuentas administrativas y de entrenadores."
      },
      sports: {
        title: "Academias",
        description: "Administra academias, categorías y niveles desde un solo bloque."
      },
      coaches: {
        title: "Entrenadores y asignaciones",
        description: "Mantén la ficha del entrenador y su cobertura por academia, categoría y nivel."
      },
      athletes: {
        title: "Deportistas",
        description: "Consulta y administra el padrón de atletas con filtros rápidos."
      },
      operations: {
        title: "Operación diaria",
        description: "Trabaja sesiones y convocatorias sin distraerte con módulos administrativos."
      },
      billing: {
        title: "Facturación",
        description: "Gestiona planes, facturas y reportes mensuales desde un workspace dedicado."
      },
      communications: {
        title: "Comunicaciones",
        description: "Publica avisos y revisa el histórico sin mezclar otras tareas."
      },
    },
  },
  general: {
    defaultModule: "athletes",
    titleId: "generalWorkspaceTitle",
    descriptionId: "generalWorkspaceDescription",
    modules: {
      athletes: {
        title: "Mis deportistas",
        description: "Consulta y gestiona la información principal de tus atletas."
      },
      reports: {
        title: "Reportes",
        description: "Revisa la asistencia mensual de tus deportistas."
      },
      plans: {
        title: "Planes",
        description: "Asigna y revisa los planes de facturación activos por atleta."
      },
      payments: {
        title: "Pagos",
        description: "Sube comprobantes y sigue el estado de tus facturas."
      },
      communications: {
        title: "Comunicaciones",
        description: "Consulta avisos relevantes para tus deportistas."
      },
    },
  },
  coach: {
    defaultModule: "profile",
    titleId: "coachWorkspaceTitle",
    descriptionId: "coachWorkspaceDescription",
    modules: {
      profile: {
        title: "Mi perfil",
        description: "Mantén tu perfil actualizado y a mano para la operación diaria."
      },
      athletes: {
        title: "Deportistas",
        description: "Consulta tus equipos y el listado general de atletas con filtros rápidos."
      },
      operations: {
        title: "Operación diaria",
        description: "Gestiona asistencia y convocatorias desde una sola vista."
      },
      communications: {
        title: "Comunicaciones",
        description: "Envía avisos a tus niveles y revisa el histórico sin ruido extra."
      },
    },
  },
};

const DASHBOARD_WORKSPACE_SUMMARY_STATE = {
  admin: {},
  general: {},
  coach: {},
};

const DASHBOARD_WORKSPACE_SUMMARY_CONFIG = {
  admin: {
    users: {
      metrics: [
        { label: "Cuentas", value: "—" },
        { label: "Activas", value: "—" },
        { label: "Foco", value: "Accesos" },
      ],
      action: { label: "Crear usuario", handler: openCreateUser },
    },
    sports: {
      metrics: [
        { label: "Control", value: "Academias" },
        { label: "Estructura", value: "Categorías" },
        { label: "Vista", value: "Configuración" },
      ],
    },
    coaches: {
      metrics: [
        { label: "Cobertura", value: "Perfiles" },
        { label: "Asignación", value: "Niveles" },
        { label: "Estado", value: "Operativo" },
      ],
      action: { label: "Nuevo entrenador", handler: openCreateCoach },
    },
    athletes: {
      metrics: [
        { label: "Visibles", value: "—" },
        { label: "Filtros", value: "0" },
        { label: "Inactivos", value: "—" },
      ],
      action: { label: "Agregar atleta", handler: openCreateAthlete },
    },
    operations: {
      metrics: [
        { label: "Ritmo", value: "Sesiones" },
        { label: "Agenda", value: "Convocatorias" },
        { label: "Vista", value: "Hoy" },
      ],
    },
    billing: {
      metrics: [
        { label: "Facturas", value: "—" },
        { label: "Pendientes", value: "—" },
        { label: "Planes", value: "—" },
      ],
      action: { label: "Ver reporte mensual", selector: "#billingReportMonth" },
    },
    communications: {
      metrics: [
        { label: "Canal", value: "Avisos" },
        { label: "Destino", value: "Segmentado" },
        { label: "Adjuntos", value: "Opcionales" },
      ],
    },
  },
  general: {
    athletes: {
      metrics: [
        { label: "Atletas", value: "—" },
        { label: "Filtros", value: "0" },
        { label: "Vista", value: "Familia" },
      ],
      action: { label: "Agregar atleta", handler: openCreateAthlete },
    },
    reports: {
      metrics: [
        { label: "Cobertura", value: "Asistencia" },
        { label: "Exporta", value: "CSV y PDF" },
        { label: "Vista", value: "Mensual" },
      ],
      action: { label: "Elegir mes", selector: "#generalReportMonth" },
    },
    plans: {
      metrics: [
        { label: "Seguimiento", value: "Planes" },
        { label: "Cambio", value: "Próximo periodo" },
        { label: "Vista", value: "Por atleta" },
      ],
      action: { label: "Seleccionar atleta", selector: "#generalPlanAthlete" },
    },
    payments: {
      metrics: [
        { label: "Comprobantes", value: "Seguimiento" },
        { label: "Estado", value: "Pendiente" },
        { label: "Vista", value: "Historial" },
      ],
      action: { label: "Buscar pagos", selector: "#generalPaymentsSearch" },
    },
    communications: {
      metrics: [
        { label: "Canal", value: "Avisos" },
        { label: "Destino", value: "Tus deportistas" },
        { label: "Vista", value: "Historial" },
      ],
    },
  },
  coach: {
    profile: {
      metrics: [
        { label: "Identidad", value: "Perfil" },
        { label: "Rol", value: "Entrenador" },
        { label: "Vista", value: "Resumen" },
      ],
    },
    athletes: {
      metrics: [
        { label: "Equipos", value: "Consulta" },
        { label: "Filtros", value: "Rápidos" },
        { label: "Vista", value: "Entrenador" },
      ],
    },
    operations: {
      metrics: [
        { label: "Asistencia", value: "Diaria" },
        { label: "Convocatoria", value: "Activa" },
        { label: "Vista", value: "Operación" },
      ],
    },
    communications: {
      metrics: [
        { label: "Canal", value: "Avisos" },
        { label: "Destino", value: "Tus niveles" },
        { label: "Vista", value: "Historial" },
      ],
    },
  },
};

const DASHBOARD_MODULE_LOADERS = {
  admin: {
    users: [() => loadUsers()],
    sports: [() => adminInitMaintenance()],
    coaches: [async () => {
      await loadCoaches();
      await adminInitCoachAssignments();
    }],
    athletes: [() => loadAthletes()],
    operations: [async () => {
      await loadAdminTrainingSessions();
      await initCallups();
    }],
    billing: [() => loadAdminBilling()],
    communications: [() => initAdminAnnouncements()],
  },
  general: {
    athletes: [() => loadAthletes()],
    reports: [],
    plans: [async () => {
      await ensureDashboardModuleLoaded("general", "athletes");
      await loadGeneralPlans();
      await loadGeneralSubscriptions();
    }],
    payments: [() => loadGeneralPayments()],
    communications: [() => loadAnnouncements("general")],
  },
  coach: {
    profile: [() => loadCoachProfile()],
    athletes: [() => loadCoachAthletePanels()],
    operations: [async () => {
      await loadCoachTrainingSessions();
      await initCallups();
    }],
    communications: [() => initCoachAnnouncements()],
  },
};

const dashboardCommon = window.DashboardCommon;

if (!dashboardCommon) {
  throw new Error("DashboardCommon no esta disponible.");
}

const {
  authHeaders,
  resolveFileUrl,
  initCollapsibles,
  computeAge,
  formatBirth,
  formatMoney,
  formatBillingType,
  getInvoiceStatusRank,
  formatInvoiceStatus,
  formatAnnouncementPriority,
  formatAnnouncementTarget,
  setStatusMessage,
  getFilterValues,
  athleteMatchesFilters,
  setSelectOptions,
  buildFilterOptionsFromAthletes,
  initAthleteFilters,
  renderReportWithFilters: renderDashboardReportWithFilters,
  renderReportTable: renderDashboardReportTable,
  renderReportTableRows: renderDashboardReportTableRows,
  getReportFilterValues,
  applyReportFilters,
  formatCalendarTimeRange,
  formatLevelLabels,
  formatSessionDate,
  ensureCalendarTooltip,
  attachCalendarTooltip,
  formatSessionTime,
  paginateList,
  showConfirmModal,
  showAlertModal,
  show,
  hide,
} = dashboardCommon;

function getDashboardBilling() {
  const billingModule = window.DashboardBilling;
  if (!billingModule) {
    throw new Error("DashboardBilling no esta disponible.");
  }
  return billingModule;
}

function getDashboardCommunications() {
  const communicationsModule = window.DashboardCommunications;
  if (!communicationsModule) {
    throw new Error("DashboardCommunications no esta disponible.");
  }
  return communicationsModule;
}

function getDashboardMaintenance() {
  const maintenanceModule = window.DashboardMaintenance;
  if (!maintenanceModule) {
    throw new Error("DashboardMaintenance no esta disponible.");
  }
  return maintenanceModule;
}

function getDashboardOperations() {
  const operationsModule = window.DashboardOperations;
  if (!operationsModule) {
    throw new Error("DashboardOperations no esta disponible.");
  }
  return operationsModule;
}

function getDashboardReports() {
  const reportsModule = window.DashboardReports;
  if (!reportsModule) {
    throw new Error("DashboardReports no esta disponible.");
  }
  return reportsModule;
}

function getDashboardAthletes() {
  const athletesModule = window.DashboardAthletes;
  if (!athletesModule) {
    throw new Error("DashboardAthletes no esta disponible.");
  }
  return athletesModule;
}

function getDashboardCallups() {
  const callupsModule = window.DashboardCallups;
  if (!callupsModule) {
    throw new Error("DashboardCallups no esta disponible.");
  }
  return callupsModule;
}

function getDashboardCoachAssignments() {
  const coachAssignmentsModule = window.DashboardCoachAssignments;
  if (!coachAssignmentsModule) {
    throw new Error("DashboardCoachAssignments no esta disponible.");
  }
  return coachAssignmentsModule;
}

function getDashboardCoaches() {
  const coachesModule = window.DashboardCoaches;
  if (!coachesModule) {
    throw new Error("DashboardCoaches no esta disponible.");
  }
  return coachesModule;
}

function getDashboardUsers() {
  const usersModule = window.DashboardUsers;
  if (!usersModule) {
    throw new Error("DashboardUsers no esta disponible.");
  }
  return usersModule;
}

function getDashboardModuleCards(roleName) {
  return Array.from(document.querySelectorAll("[data-dashboard-module]"))
    .filter((element) => {
      const roles = String(element.dataset.dashboardRoles || "")
        .split(/\s+/)
        .filter(Boolean);
      return roles.includes(roleName);
    });
}

function getDashboardModuleState(roleName, moduleName) {
  if (!dashboardModuleLoadState[roleName]) {
    dashboardModuleLoadState[roleName] = {};
  }
  if (!dashboardModuleLoadState[roleName][moduleName]) {
    dashboardModuleLoadState[roleName][moduleName] = {
      status: "idle",
      promise: null,
    };
  }
  return dashboardModuleLoadState[roleName][moduleName];
}

function isDashboardModuleLoaded(roleName, moduleName) {
  return getDashboardModuleState(roleName, moduleName).status === "ready";
}

async function ensureDashboardModuleLoaded(roleName, moduleName) {
  const moduleState = getDashboardModuleState(roleName, moduleName);
  if (moduleState.status === "ready") return;
  if (moduleState.status === "loading" && moduleState.promise) {
    await moduleState.promise;
    return;
  }

  const loaders = DASHBOARD_MODULE_LOADERS[roleName]?.[moduleName] || [];
  moduleState.status = "loading";
  moduleState.promise = (async () => {
    for (const loader of loaders) {
      if (typeof loader === "function") {
        await loader();
      }
    }
    moduleState.status = "ready";
    moduleState.promise = null;
  })().catch((error) => {
    moduleState.status = "idle";
    moduleState.promise = null;
    console.error(`Error cargando módulo ${roleName}/${moduleName}`, error);
    throw error;
  });

  await moduleState.promise;
}

function updateWorkspaceCopy(roleName, moduleName) {
  const config = DASHBOARD_WORKSPACE_CONFIG[roleName];
  if (!config) return;
  const moduleConfig = config.modules[moduleName];
  if (!moduleConfig) return;
  const title = document.getElementById(config.titleId);
  const description = document.getElementById(config.descriptionId);
  if (title) title.textContent = moduleConfig.title;
  if (description) description.textContent = moduleConfig.description;
}

function getWorkspaceSummaryElements(roleName) {
  return {
    stats: document.getElementById(`${roleName}WorkspaceStats`),
    action: document.getElementById(`${roleName}WorkspaceAction`),
  };
}

function focusWorkspaceTarget(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (typeof target.focus === "function") {
    target.focus({ preventScroll: true });
  }
}

function getWorkspaceSummary(roleName, moduleName) {
  const config = DASHBOARD_WORKSPACE_SUMMARY_CONFIG[roleName]?.[moduleName] || {};
  const runtime = DASHBOARD_WORKSPACE_SUMMARY_STATE[roleName]?.[moduleName] || {};
  return {
    metrics: runtime.metrics || config.metrics || [],
    action: runtime.action || config.action || null,
  };
}

function renderWorkspaceSummary(roleName, moduleName) {
  const { stats, action } = getWorkspaceSummaryElements(roleName);
  if (!stats || !action) return;

  const summary = getWorkspaceSummary(roleName, moduleName);
  stats.innerHTML = summary.metrics
    .map(
      (item) => `
        <div class="dashboard-workspace-stat">
          <span class="dashboard-workspace-stat-label">${item.label}</span>
          <span class="dashboard-workspace-stat-value">${item.value}</span>
        </div>
      `
    )
    .join("");

  if (!summary.action) {
    action.classList.remove("is-visible");
    action.textContent = "";
    action.onclick = null;
    return;
  }

  action.textContent = summary.action.label;
  action.classList.add("is-visible");
  action.onclick = async () => {
    if (typeof summary.action.handler === "function") {
      await summary.action.handler();
      return;
    }
    if (summary.action.selector) {
      focusWorkspaceTarget(summary.action.selector);
    }
  };
}

function setWorkspaceModuleSummary(roleName, moduleName, summary) {
  if (!DASHBOARD_WORKSPACE_SUMMARY_STATE[roleName]) {
    DASHBOARD_WORKSPACE_SUMMARY_STATE[roleName] = {};
  }

  DASHBOARD_WORKSPACE_SUMMARY_STATE[roleName][moduleName] = {
    ...(DASHBOARD_WORKSPACE_SUMMARY_STATE[roleName][moduleName] || {}),
    ...(summary || {}),
  };

  if (role === roleName && activeDashboardModule === moduleName) {
    renderWorkspaceSummary(roleName, moduleName);
  }
}

function syncDashboardNavState(roleName, moduleName) {
  document
    .querySelectorAll(`[data-dashboard-nav-role="${roleName}"]`)
    .forEach((button) => {
      const isActive = button.dataset.dashboardModuleTarget === moduleName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
}

function syncAdminAuxPanels(moduleName) {
  const generalPanel = document.getElementById("generalPanel");
  if (!generalPanel) return;
  if (role === "admin") {
    if (moduleName === "athletes") show(generalPanel);
    else hide(generalPanel);
  }
}

function syncDashboardShellState(roleName) {
  const generalShell = document.querySelector('[data-dashboard-shell-role="general"]');
  if (!generalShell) return;

  if (roleName === "general") show(generalShell);
  else hide(generalShell);
}

async function activateDashboardModule(roleName, moduleName) {
  const config = DASHBOARD_WORKSPACE_CONFIG[roleName];
  if (!config || !config.modules[moduleName]) return;
  activeDashboardModule = moduleName;

  getDashboardModuleCards(roleName).forEach((element) => {
    if (element.dataset.dashboardModule === moduleName) show(element);
    else hide(element);
  });

  syncDashboardNavState(roleName, moduleName);
  updateWorkspaceCopy(roleName, moduleName);
  renderWorkspaceSummary(roleName, moduleName);
  syncAdminAuxPanels(moduleName);
  syncDashboardShellState(roleName);
  await ensureDashboardModuleLoaded(roleName, moduleName);
}

function setupDashboardModuleNavigation(roleName) {
  document
    .querySelectorAll(`[data-dashboard-nav-role="${roleName}"]`)
    .forEach((button) => {
      if (button.dataset.dashboardNavBound === "true") return;
      button.dataset.dashboardNavBound = "true";
      button.addEventListener("click", async () => {
        const targetModule = button.dataset.dashboardModuleTarget;
        if (!targetModule || targetModule === activeDashboardModule) return;
        await activateDashboardModule(roleName, targetModule);
      });
    });
}

async function initDashboardWorkspace(roleName) {
  const config = DASHBOARD_WORKSPACE_CONFIG[roleName];
  if (!config) return;
  setupDashboardModuleNavigation(roleName);
  await activateDashboardModule(roleName, config.defaultModule);
}

// Carga academias en <select> (ej: crear/editar atleta, asignación de coach)
async function loadAcademiesSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const headers = {};
    if (token) headers["Authorization"] = "Bearer " + token;

    const res = await fetch(`${API_URL}/academies/`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar las academias");

    sel.innerHTML =
      `<option value="">Seleccione una academia…</option>` +
      data
        .map(
          (a) =>
            `<option value="${a.id}">${a.code ? a.code + " - " : ""}${a.name}</option>`
        )
        .join("");
  } catch (e) {
    console.error(e);
    sel.innerHTML = `<option value="">Error cargando academias</option>`;
  }
}

// Carga categorías para una academia en un select
async function loadCategoriesSelect(academyId, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  if (!academyId) {
    sel.innerHTML = `<option value="">Seleccione una categoría…</option>`;
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/categories/?academy_id=${academyId}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar las categorías");

    sel.innerHTML =
      `<option value="">Seleccione una categoría…</option>` +
      data.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  } catch (e) {
    console.error(e);
    sel.innerHTML = `<option value="">Error cargando categorías</option>`;
  }
}

// Carga niveles para una categoría en un select
async function loadLevelsSelect(categoryId, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  if (!categoryId) {
    sel.innerHTML = `<option value="">Seleccione un nivel…</option>`;
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/levels/?category_id=${categoryId}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");

    sel.innerHTML =
      `<option value="">Seleccione un nivel…</option>` +
      data.map((l) => `<option value="${l.id}">${l.name}</option>`).join("");
  } catch (e) {
    console.error(e);
    sel.innerHTML = `<option value="">Error cargando niveles</option>`;
  }
}

// Cargar coaches en un select (usuarios con rol coach)
async function loadCoachesSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const res = await fetch(`${API_URL}/coaches/`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los entrenadores");

    sel.innerHTML =
      `<option value="">Seleccione un entrenador…</option>` +
      data
        .map((c) => `<option value="${c.user_id}">${c.full_name}</option>`)
        .join("");
  } catch (e) {
    console.error(e);
    sel.innerHTML = `<option value="">Error cargando entrenadores</option>`;
  }
}

async function setAcademyTopbarName() {
  const titleEl = document.getElementById("academyTopbarName");
  if (!titleEl) return;

  let academyName = String(window.APP_ACADEMY_NAME || "").trim() || "Ginga Academy";

  try {
    const res = await fetch(`${API_URL}/auth/config`);
    const data = await res.json();
    const fromEnv = String(data?.academy_display_name || "").trim();
    if (res.ok && fromEnv) {
      academyName = fromEnv;
      window.APP_ACADEMY_NAME = fromEnv;
    }
  } catch {
    // Keep local fallback when config endpoint is unavailable.
  }

  titleEl.textContent = academyName;
}

function setBadge() {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const email = payload.sub || "";
    document.getElementById("userBadge").innerHTML =
      `<span class="w3-tag w3-white w3-round-xxlarge w3-padding-small">
        ${email}
      </span>`;
  } catch {
    document.getElementById("userBadge").textContent = "";
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

function openChangePassword() {
  const modal = document.getElementById("modalChangePassword");
  if (!modal) return;
  document.getElementById("dashCpCurrent").value = "";
  document.getElementById("dashCpNew").value = "";
  document.getElementById("dashCpConfirm").value = "";
  const msg = document.getElementById("dashCpMsg");
  if (msg) msg.textContent = "";
  modal.style.display = "block";
}

function closeChangePassword() {
  const modal = document.getElementById("modalChangePassword");
  if (modal) modal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const freq = document.getElementById("tsFrequency");
  if (freq) freq.addEventListener("change", handleFrequencyChange);
});

async function submitChangePassword() {
  const current_password = document.getElementById("dashCpCurrent").value;
  const new_password = document.getElementById("dashCpNew").value;
  const confirm = document.getElementById("dashCpConfirm").value;
  const msg = document.getElementById("dashCpMsg");
  if (msg) msg.textContent = "";

  if (new_password !== confirm) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Las contraseñas nuevas no coinciden.";
    }
    return;
  }

  setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
  try {
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al cambiar contraseña");
    if (msg) {
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Contraseña actualizada correctamente.";
    }
    setTimeout(closeChangePassword, 800);
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

// --------------------------------------------------
// Init
// --------------------------------------------------

window.addEventListener("load", async () => {
  await setAcademyTopbarName();
  setBadge();
  initCollapsibles();

  const adminPanel = document.getElementById("adminPanel");
  const generalPanel = document.getElementById("generalPanel");
  const coachPanel = document.getElementById("coachPanel");

  // Combos de academias para atletas (crear / editar)
  await loadAcademiesSelect("aAcademy");
  await loadAcademiesSelect("eAcademy"); // por si luego la agregas a edición

  if (role === "admin") {
    show(adminPanel);
    hide(generalPanel);
    hide(coachPanel);
    await initDashboardWorkspace("admin");
    const generalReport = document.getElementById("generalReportSection");
    if (generalReport) generalReport.style.display = "none";
    const generalPayments = document.getElementById("generalPaymentsSection");
    if (generalPayments) generalPayments.style.display = "none";
    const generalAnnouncements = document.getElementById("generalAnnouncementsSection");
    if (generalAnnouncements) generalAnnouncements.style.display = "none";
    const generalPlans = document.getElementById("generalPlansSection");
    if (generalPlans) generalPlans.style.display = "none";
  } else if (role === "coach") {
    hide(adminPanel);
    hide(generalPanel);
    show(coachPanel);
    await initDashboardWorkspace("coach");
  } else {
    hide(adminPanel);
    show(generalPanel);
    hide(coachPanel);
    await initDashboardWorkspace("general");
  }
});

window.DashboardShell = {
  setWorkspaceModuleSummary,
};

// --------------------------------------------------
// ADMIN: Usuarios
// --------------------------------------------------

async function loadUsers() {
  return getDashboardUsers().loadUsers();
}

async function toggleStatus(userId) {
  return getDashboardUsers().toggleStatus(userId);
}

async function resetUserPassword(userId) {
  return getDashboardUsers().resetUserPassword(userId);
}

function openCreateUser() {
  return getDashboardUsers().openCreateUser();
}

function closeCreateUser() {
  return getDashboardUsers().closeCreateUser();
}

async function createUser() {
  return getDashboardUsers().createUser();
}

function openEditUser(u) {
  return getDashboardUsers().openEditUser(u);
}

function closeEditUser() {
  return getDashboardUsers().closeEditUser();
}

async function updateUser() {
  return getDashboardUsers().updateUser();
}

async function loadCoaches() {
  return getDashboardCoaches().loadCoaches();
}

async function adminInitCoachAssignments() {
  return getDashboardCoachAssignments().adminInitCoachAssignments();
}

async function loadCoachProfile() {
  return getDashboardCoaches().loadCoachProfile();
}

function openCreateCoach() {
  return getDashboardCoaches().openCreateCoach();
}

function closeCreateCoach() {
  return getDashboardCoaches().closeCreateCoach();
}

function openEditCoach(coach) {
  return getDashboardCoaches().openEditCoach(coach);
}

async function saveCoach() {
  return getDashboardCoaches().saveCoach();
}

async function deleteCoach(coachId) {
  return getDashboardCoaches().deleteCoach(coachId);
}

function openCreateCoachProfile() {
  return getDashboardCoaches().openCreateCoachProfile();
}

function openEditCoachProfile() {
  return getDashboardCoaches().openEditCoachProfile();
}

// --------------------------------------------------
// ADMIN: Mantenimientos (Academias, Categorías, Niveles)
// --------------------------------------------------

async function adminInitMaintenance() {
  return getDashboardMaintenance().adminInitMaintenance();
}

async function loadAdminTrainingSessions() {
  return getDashboardOperations().loadAdminTrainingSessions();
}

async function loadMonthlyReport() {
  return getDashboardReports().loadMonthlyReport();
}

async function loadCoachMonthlyReport() {
  return getDashboardReports().loadCoachMonthlyReport();
}

async function loadGeneralMonthlyReport() {
  return getDashboardReports().loadGeneralMonthlyReport();
}

function fillGeneralPlanAthleteSelect(athletes = []) {
  return getDashboardBilling().fillGeneralPlanAthleteSelect(athletes);
}

async function loadGeneralPayments() {
  return getDashboardBilling().loadGeneralPayments();
}

async function loadGeneralPlans() {
  return getDashboardBilling().loadGeneralPlans();
}

async function loadGeneralSubscriptions() {
  return getDashboardBilling().loadGeneralSubscriptions();
}

async function selectAthletePlan() {
  return getDashboardBilling().selectAthletePlan();
}

function openPaymentProof(invoiceId) {
  return getDashboardBilling().openPaymentProof(invoiceId);
}

function closePaymentProof() {
  return getDashboardBilling().closePaymentProof();
}

async function submitPaymentProof() {
  return getDashboardBilling().submitPaymentProof();
}

async function loadAdminBilling() {
  return getDashboardBilling().loadAdminBilling();
}

async function createBillingPlan() {
  return getDashboardBilling().createBillingPlan();
}

function openEditBillingPlan(plan) {
  return getDashboardBilling().openEditBillingPlan(plan);
}

function cancelEditBillingPlan() {
  return getDashboardBilling().cancelEditBillingPlan();
}

async function toggleBillingPlanStatus(planId, isActive) {
  return getDashboardBilling().toggleBillingPlanStatus(planId, isActive);
}

async function createBillingInvoice() {
  return getDashboardBilling().createBillingInvoice();
}

function openEditInvoice(inv) {
  return getDashboardBilling().openEditInvoice(inv);
}

async function loadAdminInvoices() {
  return getDashboardBilling().loadAdminInvoices();
}

async function markInvoicePaid(invoiceId) {
  return getDashboardBilling().markInvoicePaid(invoiceId);
}

async function cancelInvoice(invoiceId) {
  return getDashboardBilling().cancelInvoice(invoiceId);
}

async function loadBillingReport() {
  return getDashboardBilling().loadBillingReport();
}

async function generateMonthlyInvoices() {
  return getDashboardBilling().generateMonthlyInvoices();
}

async function fixInvoicePeriods() {
  return getDashboardBilling().fixInvoicePeriods();
}

function exportBillingCsv() {
  return getDashboardBilling().exportBillingCsv();
}

function exportBillingPdf() {
  return getDashboardBilling().exportBillingPdf();
}

async function initAdminAnnouncements() {
  return getDashboardCommunications().initAdminAnnouncements();
}

async function initCoachAnnouncements() {
  return getDashboardCommunications().initCoachAnnouncements();
}

async function loadAnnouncements(roleKey) {
  return getDashboardCommunications().loadAnnouncements(roleKey);
}

async function createAnnouncement(roleKey) {
  return getDashboardCommunications().createAnnouncement(roleKey);
}

function openEditAnnouncement(roleKey, announcement) {
  return getDashboardCommunications().openEditAnnouncement(roleKey, announcement);
}

async function retireAnnouncement(roleKey, id) {
  return getDashboardCommunications().retireAnnouncement(roleKey, id);
}

async function deleteAnnouncementAttachment(attachmentId, roleKey) {
  return getDashboardCommunications().deleteAnnouncementAttachment(attachmentId, roleKey);
}

async function loadCoachTrainingSessions() {
  return getDashboardOperations().loadCoachTrainingSessions();
}

async function initCallups() {
  return getDashboardCallups().initCallups();
}

function showCreateForm() {
  return getDashboardCallups().showCreateForm();
}

function hideCreateForm() {
  return getDashboardCallups().hideCreateForm();
}

function backToList() {
  return getDashboardCallups().backToList();
}

async function loadCallups() {
  return getDashboardCallups().loadCallups();
}

async function createCallup() {
  return getDashboardCallups().createCallup();
}

async function onAcademyChange() {
  return getDashboardCallups().onAcademyChange();
}

async function onCategoryChange() {
  return getDashboardCallups().onCategoryChange();
}

async function autoResolveCoach() {
  return getDashboardCallups().autoResolveCoach();
}

function changeScope(scope) {
  return getDashboardCallups().changeScope(scope);
}

async function addSelectedPlayers() {
  return getDashboardCallups().addSelectedPlayers();
}

async function loadCallupDetail(callupId) {
  return getDashboardCallups().loadCallupDetail(callupId);
}

async function removePlayer(playerId) {
  return getDashboardCallups().removePlayer(playerId);
}

async function sendCallup(callupId) {
  return getDashboardCallups().sendCallup(callupId);
}

async function cancelCallup(callupId) {
  return getDashboardCallups().cancelCallup(callupId);
}

async function completeCallup(callupId) {
  return getDashboardCallups().completeCallup(callupId);
}

async function showEditForm(callupId) {
  return getDashboardCallups().showEditForm(callupId);
}

function hideEditForm() {
  return getDashboardCallups().hideEditForm();
}

async function updateCallup(callupId) {
  return getDashboardCallups().updateCallup(callupId);
}

async function editCheckConflict() {
  return getDashboardCallups().editCheckConflict();
}

async function createCheckConflict() {
  return getDashboardCallups().createCheckConflict();
}

async function generateCallupInvoices(callupId) {
  return getDashboardCallups().generateCallupInvoices(callupId);
}

async function showMatchStatsPanel(callupId) {
  return getDashboardCallups().showMatchStatsPanel(callupId);
}

function hideMatchStatsPanel() {
  return getDashboardCallups().hideMatchStatsPanel();
}

async function saveMatchStats() {
  return getDashboardCallups().saveMatchStats();
}

function addGoalToPlayer(cpId) {
  return getDashboardCallups().addGoalToPlayer(cpId);
}

function closeGoalModal() {
  return getDashboardCallups().closeGoalModal();
}

function confirmAddGoal(cpId) {
  return getDashboardCallups().confirmAddGoal(cpId);
}

function removeGoalFromPlayer(cpId, goalIdx) {
  return getDashboardCallups().removeGoalFromPlayer(cpId, goalIdx);
}

async function loadAnnouncementTeamLevelsForCoach(coachId, selectId) {
  return getDashboardCommunications().loadAnnouncementTeamLevelsForCoach(coachId, selectId);
}

function exportAthletesCsv(scope) {
  return getDashboardAthletes().exportAthletesCsv(scope);
}

function exportAthletesPdf(scope) {
  return getDashboardAthletes().exportAthletesPdf(scope);
}

async function loadAthletes() {
  return getDashboardAthletes().loadAthletes();
}

async function openAttendance(sessionId) {
  return getDashboardOperations().openAttendance(sessionId);
}

async function openCreateSession() {
  return getDashboardOperations().openCreateSession();
}

async function openEditSession(sessionId) {
  return getDashboardOperations().openEditSession(sessionId);
}

function closeCreateSession() {
  return getDashboardOperations().closeCreateSession();
}

async function saveCreateSession() {
  return getDashboardOperations().saveCreateSession();
}

async function cancelSession() {
  return getDashboardOperations().cancelSession();
}

async function cancelSeries() {
  return getDashboardOperations().cancelSeries();
}

function handleFrequencyChange() {
  return getDashboardOperations().handleFrequencyChange();
}

function closeAttendance() {
  return getDashboardOperations().closeAttendance();
}

async function saveAttendance() {
  return getDashboardOperations().saveAttendance();
}

async function loadCoachAthletePanels() {
  return getDashboardAthletes().loadCoachAthletePanels();
}

function closeAthleteDetail() {
  return getDashboardAthletes().closeAthleteDetail();
}

async function openAthleteDetail(athleteId) {
  return getDashboardAthletes().openAthleteDetail(athleteId);
}

function getUserId() {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_id;
  } catch {
    return null;
  }
}

Object.assign(window, {
  loadCoachesSelect,
  loadAcademiesSelect,
  loadCategoriesSelect,
  loadLevelsSelect,
});

function closeAssignLevel() {
  return getDashboardAthletes().closeAssignLevel();
}

async function openAssignLevel(athleteId) {
  return getDashboardAthletes().openAssignLevel(athleteId);
}

async function saveAssignLevel() {
  return getDashboardAthletes().saveAssignLevel();
}

async function removeAthleteAssignment(athleteId, assignmentId) {
  return getDashboardAthletes().removeAthleteAssignment(athleteId, assignmentId);
}

function openCreateAthlete() {
  return getDashboardAthletes().openCreateAthlete();
}

function closeCreateAthlete() {
  return getDashboardAthletes().closeCreateAthlete();
}

async function createAthlete() {
  return getDashboardAthletes().createAthlete();
}

// --- Editar atleta ---

function openEditAthlete(a) {
  return getDashboardAthletes().openEditAthlete(a);
}

function closeEditAthlete() {
  return getDashboardAthletes().closeEditAthlete();
}

async function updateAthlete() {
  return getDashboardAthletes().updateAthlete();
}

async function deleteAthlete(id) {
  return getDashboardAthletes().deleteAthlete(id);
}

async function reactivateAthlete(id) {
  return getDashboardAthletes().reactivateAthlete(id);
}

// Ensure inline handlers can find domain wrappers even if script loading changes.
Object.assign(window, {
  createBillingPlan,
  createBillingInvoice,
  selectAthletePlan,
  openEditInvoice,
  cancelInvoice,
  markInvoicePaid,
  loadBillingReport,
  generateMonthlyInvoices,
  fixInvoicePeriods,
  exportBillingCsv,
  exportBillingPdf,
});

Object.assign(window, {
  exportAthletesCsv,
  exportAthletesPdf,
  reactivateAthlete,
});

Object.assign(window, {
  createAnnouncement,
  openEditAnnouncement,
  retireAnnouncement,
  deleteAnnouncementAttachment,
});

Object.assign(window, {
  cancelSession,
  cancelSeries,
});

Object.assign(window, {
  resetUserPassword,
});

Object.assign(window, {
  openCreateCoach,
  closeCreateCoach,
  openEditCoach,
  saveCoach,
  deleteCoach,
  openCreateCoachProfile,
  openEditCoachProfile,
});

Object.assign(window, {
  showCreateForm,
  hideCreateForm,
  backToList,
  loadCallups,
  createCallup,
  onAcademyChange,
  onCategoryChange,
  autoResolveCoach,
  changeScope,
  addSelectedPlayers,
  loadCallupDetail,
  removePlayer,
  sendCallup,
  cancelCallup,
  completeCallup,
  showEditForm,
  hideEditForm,
  updateCallup,
  editCheckConflict,
  createCheckConflict,
  generateCallupInvoices,
  showMatchStatsPanel,
  hideMatchStatsPanel,
  saveMatchStats,
  addGoalToPlayer,
  closeGoalModal,
  confirmAddGoal,
  removeGoalFromPlayer,
});
















