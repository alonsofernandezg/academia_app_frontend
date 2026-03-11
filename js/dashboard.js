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

let editingAcademyId = null;
let editingCategoryId = null;
let editingLevelId = null;
let editingAssignmentId = null;
let changingAssignmentId = null;
let changingAssignmentCoachId = null;
let adminAthletesCache = [];
let coachAthletesCache = [];
let generalPaymentsPage = 1;
let generalPaymentsPerPage = 10;
let generalPaymentsFiltersInit = false;
let adminFiltersInit = false;
let listPagerState = {};
let coachFiltersInit = false;
let adminCalendarMonth = null;
let coachCalendarMonth = null;
let adminReportCache = [];
let coachReportCache = [];
let generalReportCache = [];
let generalInvoicesCache = [];
let generalPlansCache = [];
let generalSubscriptionsCache = [];
let billingPlansCache = [];
let adminInvoicesCache = [];
let billingReportCache = [];
let announcementsCache = [];
let adminCalendar = null;
let coachCalendar = null;
let levelLabelMap = null;
let levelColorMap = null;
let categoryColorMap = {};   // category_id → { color, name }
let levelToCategoryMap = {};  // level_id → category_id
let sessionCache = {};
let editingInvoiceId = null;
let editingPlanId = null;
let editingAnnouncementId = null;
let editingSessionId = null;

function authHeaders() {
  return {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json",
  };
}

function initCollapsibles() {
  const buttons = document.querySelectorAll("[data-collapsible]");
  buttons.forEach((btn) => {
    const targetId = btn.getAttribute("data-collapsible");
    const target = document.getElementById(targetId);
    if (!target) return;

    const setState = (isOpen) => {
      if (isOpen) {
        target.classList.remove("w3-hide");
        btn.textContent = "Cerrar";
      } else {
        target.classList.add("w3-hide");
        btn.textContent = "Abrir";
      }
    };

    setState(!target.classList.contains("w3-hide"));

    btn.addEventListener("click", () => {
      const isOpen = !target.classList.contains("w3-hide");
      setState(!isOpen);
    });
  });
}

function computeAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatBirth(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-ES");
}

function formatMoney(amount, currency) {
  const value = Number(amount);
  if (Number.isNaN(value)) return "-";
  const curr = currency || "CRC";
  return `${value.toFixed(2)} ${curr}`;
}

function formatBillingType(type) {
  if (type === "monthly") return "Mensual";
  if (type === "per_class") return "Por clase";
  return type || "-";
}

function getInvoiceStatusRank(status) {
  if (status === "pending") return 0;
  if (status === "submitted") return 1;
  if (status === "paid") return 2;
  if (status === "cancelled") return 3;
  return 9;
}

function formatInvoiceStatus(status) {
  if (status === "pending") return "Pendiente";
  if (status === "submitted") return "Comprobante enviado";
  if (status === "paid") return "Pagada";
  if (status === "cancelled") return "Cancelada";
  return status || "-";
}

function formatAnnouncementPriority(priority) {
  if (priority === "low") return "Baja";
  if (priority === "normal") return "Media";
  if (priority === "high") return "Alta";
  return priority || "-";
}

function formatAnnouncementTarget(target) {
  if (target.scope === "academy") {
    return `Academia: ${target.academy_name || "-"}`;
  }
  if (target.scope === "category") {
    return `Categoria: ${target.category_name || "-"}`;
  }
  if (target.scope === "level") {
    return `Nivel: ${target.level_name || "-"}`;
  }
  if (target.scope === "team") {
    const level = target.level_name || "-";
    const coach = target.coach_name || "-";
    return `Equipo: ${level} / ${coach}`;
  }
  return target.scope || "-";
}


function setStatusMessage(msgEl, text, className) {
  if (!msgEl) return;
  const baseClass = className || "w3-small w3-text-gray w3-center";
  const withMargin = baseClass.includes("w3-margin-top")
    ? baseClass
    : `${baseClass} w3-margin-top`;
  msgEl.className = withMargin;
  msgEl.textContent = text;
  msgEl.style.display = "block";
}

function ensureListPager(containerId, key, renderFn) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const state = listPagerState[key] || { page: 1, perPage: 10 };
  listPagerState[key] = state;

  let pager = document.getElementById(`${key}Pager`);
  if (!pager) {
    pager = document.createElement("div");
    pager.id = `${key}Pager`;
    pager.className = "w3-right-align w3-margin-top";
    pager.innerHTML = `
      <button id="${key}Prev" class="w3-button w3-white w3-border w3-round-xxlarge w3-small">Anterior</button>
      <span id="${key}Info" class="w3-small w3-text-gray w3-margin-left">P\u00e1gina 1</span>
      <button id="${key}Next" class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left">Siguiente</button>
      <select id="${key}PerPage" class="w3-select w3-border w3-round-large w3-small w3-margin-left" style="width:120px; display:inline-block;">
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="30">30</option>
      </select>
    `;
    container.parentElement.insertBefore(pager, container);

    const perPageEl = document.getElementById(`${key}PerPage`);
    const prevBtn = document.getElementById(`${key}Prev`);
    const nextBtn = document.getElementById(`${key}Next`);

    if (perPageEl) {
      perPageEl.value = String(state.perPage || 10);
      perPageEl.addEventListener("change", () => {
        const value = Number(perPageEl.value || 10);
        state.perPage = Number.isNaN(value) ? 10 : value;
        state.page = 1;
        if (renderFn) renderFn();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (state.page > 1) {
          state.page -= 1;
          if (renderFn) renderFn();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        state.page += 1;
        if (renderFn) renderFn();
      });
    }
  }

  return pager;
}

function paginateList(items, key, containerId, renderFn) {
  const container = document.getElementById(containerId);
  if (!container) return items;

  ensureListPager(containerId, key, renderFn);
  const state = listPagerState[key] || { page: 1, perPage: 10 };
  const prevBtn = document.getElementById(`${key}Prev`);
  const nextBtn = document.getElementById(`${key}Next`);
  const infoEl = document.getElementById(`${key}Info`);

  if (!items.length) {
    if (infoEl) infoEl.textContent = "P\u00e1gina 0 de 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return [];
  }

  const totalPages = Math.max(1, Math.ceil(items.length / state.perPage));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  if (infoEl) infoEl.textContent = `P\u00e1gina ${state.page} de ${totalPages}`;
  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= totalPages;

  const start = (state.page - 1) * state.perPage;
  return items.slice(start, start + state.perPage);
}

function showConfirmModal(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const msg = document.getElementById("confirmMessage");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    if (!modal || !msg || !okBtn || !cancelBtn) {
      resolve(confirm(message));
      return;
    }

    msg.textContent = message;

    const cleanup = () => {
      modal.style.display = "none";
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      window.removeEventListener("keydown", onKey);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(false);
      }
    };

    okBtn.onclick = () => {
      cleanup();
      resolve(true);
    };
    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    modal.style.display = "block";
    window.addEventListener("keydown", onKey);
  });
}

function showAlertModal(message, title) {
  const modal = document.getElementById("alertModal");
  const msg = document.getElementById("alertMessage");
  const okBtn = document.getElementById("alertOk");
  const titleEl = document.getElementById("alertTitle");

  if (!modal || !msg || !okBtn || !titleEl) {
    showAlertModal(message);
    return;
  }

  msg.textContent = message;
  if (title) titleEl.textContent = title;

  okBtn.onclick = () => {
    modal.style.display = "none";
    okBtn.onclick = null;
  };

  modal.style.display = "block";
}


function getFilterValues(prefix) {
  const getVal = (id) => document.getElementById(`${prefix}${id}`)?.value || "";
  return {
    search: getVal("AthleteSearch").trim().toLowerCase(),
    academyId: getVal("FilterAcademy"),
    categoryId: getVal("FilterCategory"),
    levelId: getVal("FilterLevel"),
    coachId: getVal("FilterCoach"),
    birthFrom: getVal("BirthFrom"),
    birthTo: getVal("BirthTo"),
  };
}

function athleteMatchesFilters(a, filters) {
  const name = `${a.first_name || ""} ${a.last_name || ""}`.toLowerCase();
  const idNumber = (a.id_number || "").toLowerCase();
  if (filters.search && !name.includes(filters.search) && !idNumber.includes(filters.search)) {
    return false;
  }

  if (filters.birthFrom || filters.birthTo) {
    if (!a.birth_date) return false;
    const birth = new Date(a.birth_date);
    if (Number.isNaN(birth.getTime())) return false;
    if (filters.birthFrom) {
      const from = new Date(filters.birthFrom);
      if (birth < from) return false;
    }
    if (filters.birthTo) {
      const to = new Date(filters.birthTo);
      if (birth > to) return false;
    }
  }

  const assignmentFilters = [
    ["academy_id", filters.academyId],
    ["category_id", filters.categoryId],
    ["level_id", filters.levelId],
    ["coach_user_id", filters.coachId],
  ].filter(([, v]) => v);

  if (!assignmentFilters.length) {
    return true;
  }

  const assignments = a.assignments || [];
  return assignments.some((as) =>
    assignmentFilters.every(([key, value]) => String(as[key] || "") === String(value))
  );
}

function setSelectOptions(selectId, items) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  const options = items
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join("");
  const baseOption = `<option value="">Todos</option>`;
  sel.innerHTML = baseOption + options;
  if (current) {
    sel.value = current;
    if (sel.value !== current) sel.value = "";
  }
}

function buildFilterOptionsFromAthletes(athletes, prefix) {
  const academyMap = new Map();
  const categoryMap = new Map();
  const levelMap = new Map();
  const coachMap = new Map();

  athletes.forEach((a) => {
    (a.assignments || []).forEach((as) => {
      if (as.academy_id && as.academy_name) academyMap.set(as.academy_id, as.academy_name);
      if (as.category_id && as.category_name) categoryMap.set(as.category_id, as.category_name);
      if (as.level_id && as.level_name) levelMap.set(as.level_id, as.level_name);
      if (as.coach_user_id && as.coach_name) coachMap.set(as.coach_user_id, as.coach_name);
    });
  });

  setSelectOptions(`${prefix}FilterAcademy`, [...academyMap].map(([id, name]) => ({ id, name })));
  setSelectOptions(`${prefix}FilterCategory`, [...categoryMap].map(([id, name]) => ({ id, name })));
  setSelectOptions(`${prefix}FilterLevel`, [...levelMap].map(([id, name]) => ({ id, name })));
  setSelectOptions(`${prefix}FilterCoach`, [...coachMap].map(([id, name]) => ({ id, name })));
}

function initAthleteFilters(prefix, renderFn) {
  const ids = [
    "AthleteSearch",
    "FilterAcademy",
    "FilterCategory",
    "FilterLevel",
    "FilterCoach",
    "BirthFrom",
    "BirthTo",
  ];
  ids.forEach((suffix) => {
    const el = document.getElementById(`${prefix}${suffix}`);
    if (!el) return;
    const eventName = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(eventName, renderFn);
  });
}

function setBadge() {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const email = payload.sub || "";
    document.getElementById("userBadge").innerHTML =
      `<span class="w3-tag w3-white w3-round-xxlarge w3-padding-small">
        ${email} · rol: <b>${role}</b>
      </span>`;
  } catch {
    document.getElementById("userBadge").textContent = `rol: ${role}`;
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
      msg.textContent = "Las contrase\u00f1as nuevas no coinciden.";
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
    if (!res.ok) throw new Error(data.detail || "Error al cambiar contrase\u00f1a");
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

function show(el) {
  el.classList.remove("w3-hide");
}
function hide(el) {
  el.classList.add("w3-hide");
}

// Carga academias en <select> (ej: crear/editar atleta, asignaci\u00f3n de coach)
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
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los coaches");

    sel.innerHTML =
      `<option value="">Seleccione un coach…</option>` +
      data
        .map((c) => `<option value="${c.user_id}">${c.full_name}</option>`)
        .join("");
  } catch (e) {
    console.error(e);
    sel.innerHTML = `<option value="">Error cargando coaches</option>`;
  }
}

// --------------------------------------------------
// Init
// --------------------------------------------------

window.addEventListener("load", async () => {
  setBadge();
  initCollapsibles();
  adminCalendarMonth = new Date();
  coachCalendarMonth = new Date();

  const adminPanel = document.getElementById("adminPanel");
  const generalPanel = document.getElementById("generalPanel");
  const coachPanel = document.getElementById("coachPanel");

  // Combos de academias para atletas (crear / editar)
  await loadAcademiesSelect("aAcademy");
  await loadAcademiesSelect("eAcademy"); // por si luego la agregas a edición

  if (role === "admin") {
    show(adminPanel);
    show(generalPanel);
    hide(coachPanel);
    await loadUsers();
    await adminInitMaintenance();
    await adminInitCoachAssignments();
    await loadAdminTrainingSessions();
    await loadAdminBilling();
    await initAdminAnnouncements();
    await initCallups();
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
    await loadCoachAthletePanels();
    await loadCoachTrainingSessions();
    await initCoachAnnouncements();
    await initCallups();
  } else {
    hide(adminPanel);
    show(generalPanel);
    hide(coachPanel);
    await loadGeneralPayments();
    await loadGeneralPlans();
    await loadGeneralSubscriptions();
    await loadAnnouncements("general");
  }

  await loadAthletes();
});

// --------------------------------------------------
// ADMIN: Usuarios
// --------------------------------------------------

async function loadUsers() {
  const box = document.getElementById("usersList");
  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando usuarios…</div>`;
  try {
    const res = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
    const users = await res.json();
    if (!res.ok) throw new Error(users.detail || "No se pudieron cargar los usuarios");

    if (!users.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay usuarios todavía.</div>`;
      return;
    }

    const pageItems = paginateList(users, "users", "usersList", loadUsers);

    box.innerHTML = pageItems
      .map(
        (u) => `
      <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom">
        <div class="w3-row">
          <div class="w3-col s12 m7">
            <b>${u.email}</b><br>
            <span class="w3-small w3-text-gray">Rol: ${u.role}</span>
          </div>
          <div class="w3-col s12 m5 w3-right-align">
            <span class="w3-small ${u.is_active ? "w3-text-green" : "w3-text-red"}" style="margin-right:8px">
              ${u.is_active ? "Activo" : "Inactivo"}
            </span>
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
              onclick='openEditUser(${JSON.stringify(u)})'>
              ✏️ Editar
            </button>
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
              onclick="resetUserPassword(${u.id})">
              Restablecer contrase\u00f1a
            </button>
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
              style="margin-left:6px"
              onclick="toggleStatus(${u.id})">
              ${u.is_active ? "Desactivar" : "Activar"}
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join("");
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

async function toggleStatus(userId) {
  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo cambiar el estado");
    await loadUsers();
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function resetUserPassword(userId) {
  const ok = await showConfirmModal("\u00bfRestablecer contrase\u00f1a? Se enviar\u00e1 una clave temporal por correo.");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.detail || "No pudimos restablecer la contrase\u00f1a. Intenta de nuevo."
      );
    }
    showAlertModal(
      data.message || "Listo. Se envi\u00f3 una contrase\u00f1a temporal al correo del usuario."
    );
  } catch (e) {
    showAlertModal(e.message || "Ocurri\u00f3 un error al restablecer la contrase\u00f1a.");
  }
}

function openCreateUser() {
  document.getElementById("cuEmail").value = "";
  document.getElementById("cuRole").value = "coach";
  document.getElementById("cuMsg").textContent = "";
  document.getElementById("modalCreateUser").style.display = "block";
}

function closeCreateUser() {
  document.getElementById("modalCreateUser").style.display = "none";
}

async function createUser() {
  const email = document.getElementById("cuEmail").value.trim();
  const roleSel = document.getElementById("cuRole").value;
  const msg = document.getElementById("cuMsg");
  msg.textContent = "";

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const res = await fetch(`${API_URL}/admin/create_user`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, role: roleSel }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo crear el usuario");
    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = "Usuario creado y correo enviado.";
    await loadUsers();
    setTimeout(closeCreateUser, 800);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

function openEditUser(u) {
  document.getElementById("euId").value = u.id;
  document.getElementById("euEmail").value = u.email;
  document.getElementById("euRole").value = u.role || "general";
  document.getElementById("euActive").value = String(u.is_active);
  document.getElementById("euMsg").textContent = "";
  document.getElementById("modalEditUser").style.display = "block";
}

function closeEditUser() {
  document.getElementById("modalEditUser").style.display = "none";
}

async function updateUser() {
  const id = document.getElementById("euId").value;
  const email = document.getElementById("euEmail").value.trim();
  const roleSel = document.getElementById("euRole").value;
  const is_active = document.getElementById("euActive").value === "true";
  const msg = document.getElementById("euMsg");
  msg.textContent = "";

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ email, role: roleSel, is_active }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el usuario");
    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = "Usuario actualizado correctamente.";
    await loadUsers();
    setTimeout(closeEditUser, 700);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

// --------------------------------------------------
// ADMIN: Mantenimientos (Academias, Categorías, Niveles)
// --------------------------------------------------

async function adminInitMaintenance() {
  // Botones
  const acadBtn = document.getElementById("admAcadCreateBtn");
  const catBtn = document.getElementById("admCatCreateBtn");
  const lvlBtn = document.getElementById("admLvlCreateBtn");
  const acadCancelBtn = document.getElementById("admAcadCancelBtn");
  const catCancelBtn = document.getElementById("admCatCancelBtn");
  const lvlCancelBtn = document.getElementById("admLvlCancelBtn");

  if (acadBtn) acadBtn.onclick = adminCreateAcademy;
  if (catBtn) catBtn.onclick = adminCreateCategory;
  if (lvlBtn) lvlBtn.onclick = adminCreateLevel;
  if (acadCancelBtn) acadCancelBtn.onclick = cancelEditAcademy;
  if (catCancelBtn) catCancelBtn.onclick = cancelEditCategory;
  if (lvlCancelBtn) lvlCancelBtn.onclick = cancelEditLevel;

  // Selects de filtro
  const selCatAcad = document.getElementById("admCatAcademy");
  const selLvlCat = document.getElementById("admLvlCategory");

  if (selCatAcad) {
    selCatAcad.onchange = () => {
      cancelEditCategory();
      cancelEditLevel();
      adminReloadCategoriesUI();
    };
  }
  if (selLvlCat) {
    selLvlCat.onchange = () => {
      cancelEditLevel();
      adminReloadLevelsUI();
    };
  }

  // Carga inicial
  await adminReloadAcademiesUI();
  await adminReloadCategoriesUI();
  await adminReloadLevelsUI();
}

async function loadAdminTrainingSessions() {
  const calendar = document.getElementById("adminSessionCalendar");
  if (!calendar) return;

  calendar.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando sesiones…</div>`;
  try {
    ensureAdminCalendar();
    adminCalendarMonth = adminCalendar.getDate();
    const { startDate, endDate } = getMonthRange(adminCalendarMonth);
    const res = await fetch(
      `${API_URL}/training-sessions/?start_date=${startDate}&end_date=${endDate}`,
      { headers: authHeaders() }
    );
    const sessions = await res.json();
    if (!res.ok) throw new Error(sessions.detail || "No se pudieron cargar las sesiones");

    cacheSessions(sessions);
    const labelMap = await getLevelLabelMap();
    setCalendarEvents(adminCalendar, sessions, labelMap);
  } catch (e) {
    calendar.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

async function loadMonthlyReport() {
  const monthInput = document.getElementById("adminReportMonth");
  const box = document.getElementById("adminMonthlyReport");
  if (!monthInput || !box) return;

  const month = monthInput.value;
  if (!month) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">Selecciona un mes.</div>`;
    return;
  }

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Generando reporte…</div>`;
  try {
    const res = await fetch(`${API_URL}/training-sessions/report?month=${month}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte");

    adminReportCache = data;
    if (!data.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin registros para el mes.</div>`;
      return;
    }

    box.innerHTML = renderReportWithFilters("admin", data);
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

async function loadCoachMonthlyReport() {
  const monthInput = document.getElementById("coachReportMonth");
  const box = document.getElementById("coachMonthlyReport");
  if (!monthInput || !box) return;

  const month = monthInput.value;
  if (!month) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">Selecciona un mes.</div>`;
    return;
  }

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Generando reporte…</div>`;
  try {
    const res = await fetch(`${API_URL}/training-sessions/report/my?month=${month}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte");
    coachReportCache = data;
    if (!data.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin registros para el mes.</div>`;
      return;
    }
    box.innerHTML = renderReportWithFilters("coach", data);
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

async function loadGeneralMonthlyReport() {
  const monthInput = document.getElementById("generalReportMonth");
  const box = document.getElementById("generalMonthlyReport");
  if (!monthInput || !box) return;

  const month = monthInput.value;
  if (!month) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">Selecciona un mes.</div>`;
    return;
  }

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Generando reporte…</div>`;
  try {
    const res = await fetch(`${API_URL}/training-sessions/report/general?month=${month}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte");
    generalReportCache = data;
    if (!data.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin registros para el mes.</div>`;
      return;
    }
    box.innerHTML = renderReportWithFilters("general", data);
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
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
  return items.filter((inv) => {
    if (filters.status && inv.status !== filters.status) return false;
    if (filters.search) {
      const haystack = `${inv.athlete_name || ""} ${inv.plan_name || ""}`.toLowerCase();
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

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando pagos...</div>`;
  try {
    const res = await fetch(`${API_URL}/billing/invoices/my`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los pagos");
    generalInvoicesCache = data;
    if (!generalPaymentsFiltersInit) {
      initGeneralPaymentsFilters();
    }
    renderGeneralPayments();
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function renderGeneralPayments() {
  const box = document.getElementById("generalPaymentsList");
  if (!box) return;

  if (!generalInvoicesCache.length) {
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay facturas registradas.</div>`;
    return;
  }

  const filters = getGeneralPaymentsFilters();
  const filtered = applyGeneralPaymentsFilters(generalInvoicesCache, filters);
  if (!filtered.length) {
    const pageInfo = document.getElementById("generalPaymentsPageInfo");
    const prevBtn = document.getElementById("generalPaymentsPrev");
    const nextBtn = document.getElementById("generalPaymentsNext");
    if (pageInfo) pageInfo.textContent = "P\u00e1gina 0 de 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay facturas para mostrar.</div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const rank = getInvoiceStatusRank(a.status) - getInvoiceStatusRank(b.status);
    if (rank !== 0) return rank;
    const ad = a.period_start ? new Date(a.period_start).getTime() : 0;
    const bd = b.period_start ? new Date(b.period_start).getTime() : 0;
    return bd - ad;
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
    .map((inv) => {
      const periodStart = inv.period_start ? formatBirth(inv.period_start) : "-";
      const periodEnd = inv.period_end ? formatBirth(inv.period_end) : "-";
      const periodText =
        inv.period_start || inv.period_end ? `${periodStart} - ${periodEnd}` : "Sin periodo";
      const statusClass =
        inv.status === "paid"
          ? "w3-text-green"
          : inv.status === "submitted"
          ? "w3-text-orange"
          : "w3-text-gray";
      const proofLink = inv.last_payment_proof_url
        ? `<div class="w3-small w3-text-gray">
            Ultimo comprobante:
            <a href="${API_URL}${inv.last_payment_proof_url}" target="_blank">Ver</a>
          </div>`
        : "";
      return `
      <div class="w3-card w3-round-xxlarge w3-padding-small w3-margin-bottom">
        <div class="w3-row">
          <div class="w3-col s12 m8 w3-padding-small">
            <b>${inv.athlete_name || "-"}</b><br>
            <span class="w3-small w3-text-gray">
              Plan: ${inv.plan_name || "Manual"}${inv.billing_type ? " (" + formatBillingType(inv.billing_type) + ")" : ""}
            </span><br>
            ${inv.callup_id ? `<span class="w3-small w3-text-blue" style="cursor:pointer" onclick="window.location.hash='#callups';setTimeout(()=>loadCallupDetail(${inv.callup_id}),200)">📋 Convocatoria: ${inv.callup_title || 'Ver'}</span><br>` : ''}
            <span class="w3-small w3-text-gray">Periodo: ${periodText}</span><br>
            <span class="w3-small w3-text-gray">Monto: ${formatMoney(inv.total_amount, inv.currency)}</span><br>
            <span class="w3-small ${statusClass}">Estado: ${formatInvoiceStatus(inv.status)}</span>
            ${proofLink}
          </div>
          <div class="w3-col s12 m4 w3-right-align w3-padding-small">
            ${inv.status !== "paid" && inv.status !== "cancelled" ? `
            <button
              class="w3-button w3-blue w3-round-xxlarge w3-small"
              onclick="openPaymentProof(${inv.id})">
              Subir comprobante
            </button>
            ` : ''}
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
    const res = await fetch(`${API_URL}/billing/plans/public`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los planes");
    generalPlansCache = data;
    renderGeneralPlanSelect();
  } catch (e) {
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
        (p) =>
          `<option value="${p.id}">${p.name} - ${formatMoney(p.amount, p.currency)} (${formatBillingType(p.billing_type)})</option>`
      )
      .join("");
}

function fillGeneralPlanAthleteSelect() {
  const select = document.getElementById("generalPlanAthlete");
  if (!select) return;
  if (!adminAthletesCache.length) {
    select.innerHTML = `<option value="">No hay atletas</option>`;
    return;
  }
  select.innerHTML =
    `<option value="">Seleccione un atleta...</option>` +
    adminAthletesCache
      .map((a) => `<option value="${a.id}">${a.first_name} ${a.last_name}</option>`)
      .join("");
}

async function loadGeneralSubscriptions() {
  const box = document.getElementById("generalPlanStatusList");
  if (!box) return;
  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando planes...</div>`;
  try {
    const res = await fetch(`${API_URL}/billing/subscriptions/my`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los planes");
    generalSubscriptionsCache = data;
    renderGeneralSubscriptions();
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
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
  generalSubscriptionsCache.forEach((s) => {
    const key = String(s.athlete_id);
    if (!byAthlete.has(key)) {
      byAthlete.set(key, { athleteName: s.athlete_name, active: null, scheduled: null });
    }
    const entry = byAthlete.get(key);
    if (s.status === "active") {
      entry.active = s;
    } else if (s.status === "scheduled") {
      entry.scheduled = s;
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
    const res = await fetch(`${API_URL}/billing/subscriptions`, {
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
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
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

  const invoice = generalInvoicesCache.find((i) => i.id === invoiceId);
  if (!invoice) return;

  document.getElementById("paymentInvoiceId").value = invoiceId;
  amountInput.value = invoice.total_amount || "";
  if (methodInput) methodInput.value = "transfer";
  if (fileInput) fileInput.value = "";
  if (msg) msg.textContent = "";

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

async function submitPaymentProof() {
  const invoiceId = document.getElementById("paymentInvoiceId").value;
  const amount = document.getElementById("paymentAmount").value;
  const method = document.getElementById("paymentMethod").value;
  const file = document.getElementById("paymentProofFile").files[0];
  const msg = document.getElementById("paymentMsg");
  if (msg) msg.textContent = "";

  if (!invoiceId) return;
  if (!file) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Debes adjuntar el comprobante.";
    }
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const fd = new FormData();
    if (amount) fd.append("amount", amount);
    fd.append("method", method);
    fd.append("file", file);

    const res = await fetch(`${API_URL}/billing/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo enviar el comprobante");

    if (msg) {
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Comprobante enviado correctamente.";
    }
    await loadGeneralPayments();
    setTimeout(closePaymentProof, 800);
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
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
      const plan = billingPlansCache.find((p) => String(p.id) === String(planId));
      const amountInput = document.getElementById("billInvoiceAmount");
      if (plan && amountInput) {
        amountInput.value = plan.amount;
      }
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

  list.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando planes...</div>`;
  try {
    const res = await fetch(`${API_URL}/billing/plans?active_only=false`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los planes");
    billingPlansCache = data;
    renderBillingPlans();
  } catch (e) {
    list.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function renderBillingPlans() {
  const list = document.getElementById("billPlanList");
  const planSelect = document.getElementById("billInvoicePlan");
  if (!list || !planSelect) return;

  if (!billingPlansCache.length) {
    list.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay planes registrados.</div>`;
    planSelect.innerHTML = `<option value="">Manual</option>`;
    return;
  }

  list.innerHTML = billingPlansCache
    .map((p) => {
      const statusText = p.is_active ? "Activo" : "Inactivo";
      const statusClass = p.is_active ? "w3-text-green" : "w3-text-gray";
      const toggleText = p.is_active ? "Inactivar" : "Activar";
      return `
      <div class="w3-padding-small w3-border-bottom">
        <div>
          <span class="w3-tag w3-round-xxlarge w3-light-gray">${p.name}</span>
          <span class="w3-small w3-text-gray" style="margin-left:6px">${formatMoney(p.amount, p.currency)}</span>
        </div>
        <div class="w3-small w3-text-gray">${formatBillingType(p.billing_type)}</div>
        <div class="w3-small ${statusClass}">${statusText}</div>
        <div class="w3-small w3-margin-top">
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
            onclick='openEditBillingPlan(${JSON.stringify(p)})'>
            Editar
          </button>
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
            onclick="toggleBillingPlanStatus(${p.id}, ${!p.is_active})">
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
      .filter((p) => p.is_active)
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
}

async function loadAdminAthleteOptions() {
  const sel = document.getElementById("billInvoiceAthlete");
  if (!sel) return;

  try {
    const url =
      role === "admin"
        ? API_URL + "/athletes/my?include_inactive=true"
        : API_URL + "/athletes/my";
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los atletas");

    const options = data
      .map((a) => `<option value="${a.id}">${a.first_name} ${a.last_name}</option>`)
      .join("");
    sel.innerHTML = `<option value="">Seleccione un atleta...</option>` + options;
  } catch (e) {
    sel.innerHTML = `<option value="">Error cargando atletas</option>`;
  }
}

async function createBillingPlan() {
  const name = document.getElementById("billPlanName").value.trim();
  const amount = document.getElementById("billPlanAmount").value;
  const billing_type = document.getElementById("billPlanType").value;
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
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const isEdit = Boolean(editingPlanId);
    const url = isEdit ? `${API_URL}/billing/plans/${editingPlanId}` : `${API_URL}/billing/plans`;
    const method = isEdit ? "PATCH" : "POST";
    const payload = {
      name,
      amount: Number(amount),
      currency: "CRC",
      billing_type,
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
      msg.textContent = isEdit ? "Plan actualizado correctamente." : "Plan creado correctamente.";
    }
    cancelEditBillingPlan();
    await loadBillingPlans();
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
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
    const res = await fetch(`${API_URL}/billing/plans/${planId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el plan");
    await loadBillingPlans();
  } catch (e) {
    showAlertModal(e.message);
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
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const url = editingInvoiceId
      ? `${API_URL}/billing/invoices/${editingInvoiceId}`
      : `${API_URL}/billing/invoices`;
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
        : "Factura creada correctamente.";
    }
    resetInvoiceForm();
    await loadAdminInvoices();
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

function openEditInvoice(inv) {
  editingInvoiceId = inv.id;
  document.getElementById("billInvoiceAthlete").value = String(inv.athlete_id || "");
  document.getElementById("billInvoicePlan").value = inv.plan_id ? String(inv.plan_id) : "";
  document.getElementById("billInvoiceStart").value = inv.period_start || "";
  document.getElementById("billInvoiceEnd").value = inv.period_end || "";
  document.getElementById("billInvoiceAmount").value = inv.total_amount || "";
  document.getElementById("billInvoiceNotes").value = inv.notes || "";
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

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando facturas...</div>`;
  try {
    const res = await fetch(`${API_URL}/billing/invoices`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar las facturas");
    adminInvoicesCache = data;
    renderAdminInvoices();
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function renderAdminInvoices() {
  const box = document.getElementById("billInvoiceList");
  if (!box) return;

  const search = (document.getElementById("billInvoiceSearch")?.value || "")
    .trim()
    .toLowerCase();
  const status = document.getElementById("billInvoiceStatus")?.value || "";

  const filtered = adminInvoicesCache.filter((inv) => {
    if (status && inv.status !== status) return false;
    if (!search) return true;
    const athlete = (inv.athlete_name || "").toLowerCase();
    const plan = (inv.plan_name || "").toLowerCase();
    return athlete.includes(search) || plan.includes(search);
  });

  if (!filtered.length) {
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay facturas registradas.</div>`;
    return;
  }

  const pageItems = paginateList(filtered, "adminInvoices", "billInvoiceList", renderAdminInvoices);

  box.innerHTML = pageItems
    .map((inv) => {
      const periodStart = inv.period_start ? formatBirth(inv.period_start) : "-";
      const periodEnd = inv.period_end ? formatBirth(inv.period_end) : "-";
      const periodText =
        inv.period_start || inv.period_end ? `${periodStart} - ${periodEnd}` : "Sin periodo";
      const statusClass =
        inv.status === "paid"
          ? "w3-text-green"
          : inv.status === "submitted"
          ? "w3-text-orange"
          : "w3-text-gray";
      const proofLink = inv.last_payment_proof_url
        ? `<div class="w3-small w3-text-gray">
            Comprobante:
            <a href="${API_URL}${inv.last_payment_proof_url}" target="_blank">Ver</a>
          </div>`
        : "";
      const markPaidButton =
        inv.status !== "paid"
          ? `<button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-top"
              onclick="markInvoicePaid(${inv.id})">
              Marcar pagada
            </button>`
          : "";
      const cancelButton =
        inv.status !== "cancelled"
          ? `<button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-top w3-margin-left"
              onclick="cancelInvoice(${inv.id})">
              Cancelar
            </button>`
          : "";
      const editButton = `<button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-top w3-margin-left"
              onclick='openEditInvoice(${JSON.stringify(inv)})'>
              Editar
            </button>`;
      return `
      <div class="w3-padding-small w3-border-bottom">
        <b>${inv.athlete_name || "-"}</b><br>
        <span class="w3-small w3-text-gray">
          Plan: ${inv.plan_name || "Manual"}${inv.billing_type ? " (" + formatBillingType(inv.billing_type) + ")" : ""}
        </span><br>
        ${inv.callup_id ? `<span class="w3-small w3-text-blue" style="cursor:pointer" onclick="window.location.hash='#callups';setTimeout(()=>loadCallupDetail(${inv.callup_id}),200)">📋 Convocatoria: ${inv.callup_title || 'Ver'}</span><br>` : ''}
        <span class="w3-small w3-text-gray">Periodo: ${periodText}</span><br>
        <span class="w3-small w3-text-gray">Monto: ${formatMoney(inv.total_amount, inv.currency)}</span><br>
        <span class="w3-small ${statusClass}">Estado: ${formatInvoiceStatus(inv.status)}</span>
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
    const res = await fetch(`${API_URL}/billing/invoices/${invoiceId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "paid" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo actualizar la factura");
    await loadAdminInvoices();
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function loadBillingReport() {
  const monthInput = document.getElementById("billingReportMonth");
  const box = document.getElementById("billingReportList");
  if (!monthInput || !box) return;

  const month = monthInput.value;
  if (!month) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">Selecciona un mes.</div>`;
    return;
  }

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Generando reporte...</div>`;
  try {
    const res = await fetch(`${API_URL}/billing/report?month=${month}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte");
    billingReportCache = data;
    if (!data.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin registros para el mes.</div>`;
      return;
    }
    box.innerHTML = renderBillingReportTable(data);
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

async function generateMonthlyInvoices() {
  const monthInput = document.getElementById("billingReportMonth");
  const msgBox = document.getElementById("billingReportList");
  if (!monthInput) return;
  const month = monthInput.value;
  if (!month) {
    if (msgBox) {
      msgBox.innerHTML = `<div class="w3-center w3-text-red w3-small">Selecciona un mes.</div>`;
    }
    return;
  }
  const ok = await showConfirmModal("\u00bfGenerar facturas para este mes?");
  if (!ok) return;
  try {
    if (msgBox) {
      msgBox.innerHTML = `<div class="w3-center w3-text-gray w3-small">Generando facturas...</div>`;
    }
    const res = await fetch(`${API_URL}/billing/subscriptions/generate-monthly?month=${month}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron generar las facturas");
    if (msgBox) {
      msgBox.innerHTML = `<div class="w3-center w3-text-green w3-small">Facturas generadas: ${data.created || 0}</div>`;
    }
    await loadAdminInvoices();
  } catch (e) {
    if (msgBox) {
      msgBox.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
    }
  }
}
async function fixInvoicePeriods() {
  const ok = await showConfirmModal(
    "\u00bfCorregir todas las fechas de per\u00edodo? Las facturas con fechas incorrectas se normalizar\u00e1n al primer y \u00faltimo d\u00eda de su mes."
  );
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/billing/invoices/fix-periods`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");
    showAlertModal(data.message || `${data.fixed} factura(s) corregida(s).`);
    await loadAdminInvoices();
  } catch (e) {
    showAlertModal(`Error: ${e.message}`);
  }
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
    .map((r) => {
      const periodStart = r.period_start ? formatBirth(r.period_start) : "-";
      const periodEnd = r.period_end ? formatBirth(r.period_end) : "-";
      const periodText =
        r.period_start || r.period_end ? `${periodStart} - ${periodEnd}` : "Sin periodo";
      return `
      <tr>
        <td>${r.invoice_id}</td>
        <td>${r.athlete_name || "-"}</td>
        <td>${r.plan_name || "Manual"}</td>
        <td>${periodText}</td>
        <td>${formatMoney(r.total_amount, r.currency)}</td>
        <td>${formatInvoiceStatus(r.status)}</td>
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
  const rows = billingReportCache.map((r) => {
    const periodStart = r.period_start || "";
    const periodEnd = r.period_end || "";
    const periodText = periodStart || periodEnd ? `${periodStart} - ${periodEnd}` : "";
    return [
      r.invoice_id,
      r.athlete_name || "",
      r.plan_name || "Manual",
      periodText,
      `${r.total_amount} ${r.currency}`,
      formatInvoiceStatus(r.status),
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

async function initAdminAnnouncements() {
  await loadAcademiesSelect("adminAnnAcademy");
  await loadCoachesSelect("adminAnnCoach");

  const scopeSel = document.getElementById("adminAnnScope");
  const academySel = document.getElementById("adminAnnAcademy");
  const categorySel = document.getElementById("adminAnnCategory");
  const coachSel = document.getElementById("adminAnnCoach");

  if (scopeSel) scopeSel.addEventListener("change", () => updateAnnouncementScope("admin"));
  if (academySel) {
    academySel.addEventListener("change", async () => {
      await loadCategoriesSelect(academySel.value, "adminAnnCategory");
      await loadLevelsSelect("", "adminAnnLevel");
    });
  }
  if (categorySel) {
    categorySel.addEventListener("change", async () => {
      await loadLevelsSelect(categorySel.value, "adminAnnLevel");
    });
  }
  if (coachSel) {
    coachSel.addEventListener("change", async () => {
      await loadAnnouncementTeamLevelsForCoach(coachSel.value, "adminAnnTeamLevel");
    });
  }

  updateAnnouncementScope("admin");
  await loadAnnouncements("admin");
}

async function initCoachAnnouncements() {
  const scopeSel = document.getElementById("coachAnnScope");
  if (scopeSel) scopeSel.addEventListener("change", () => updateAnnouncementScope("coach"));

  await loadCoachAnnouncementLevels("coachAnnLevel");
  await loadCoachAnnouncementLevels("coachAnnTeamLevel");
  updateAnnouncementScope("coach");
  await loadAnnouncements("coach");
}

function updateAnnouncementScope(roleKey) {
  const scopeSel = document.getElementById(`${roleKey}AnnScope`);
  if (!scopeSel) return;
  const scope = scopeSel.value;

  const academyWrap = document.getElementById(`${roleKey}AnnAcademyWrap`);
  const categoryWrap = document.getElementById(`${roleKey}AnnCategoryWrap`);
  const levelWrap = document.getElementById(`${roleKey}AnnLevelWrap`);
  const teamWrap = document.getElementById(`${roleKey}AnnTeamWrap`);

  if (academyWrap) academyWrap.classList.add("w3-hide");
  if (categoryWrap) categoryWrap.classList.add("w3-hide");
  if (levelWrap) levelWrap.classList.add("w3-hide");
  if (teamWrap) teamWrap.classList.add("w3-hide");

  if (scope === "academy") {
    if (academyWrap) academyWrap.classList.remove("w3-hide");
  } else if (scope === "category") {
    if (academyWrap) academyWrap.classList.remove("w3-hide");
    if (categoryWrap) categoryWrap.classList.remove("w3-hide");
  } else if (scope === "level") {
    if (academyWrap) academyWrap.classList.remove("w3-hide");
    if (categoryWrap) categoryWrap.classList.remove("w3-hide");
    if (levelWrap) levelWrap.classList.remove("w3-hide");
  } else if (scope === "team") {
    if (teamWrap) teamWrap.classList.remove("w3-hide");
    if (roleKey === "coach") {
      if (levelWrap) levelWrap.classList.add("w3-hide");
    }
  }
}

async function loadCoachAnnouncementLevels(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">Seleccione un nivel...</option>`;

  try {
    const res = await fetch(`${API_URL}/admin/coach-assignments/my/active`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");

    const options = data
      .map(
        (a) =>
          `<option value="${a.level_id}">${a.academy_name} / ${a.category_name} / ${a.level_name}</option>`
      )
      .join("");
    sel.innerHTML = `<option value="">Seleccione un nivel...</option>` + options;
  } catch (e) {
    sel.innerHTML = `<option value="">Error cargando niveles</option>`;
  }
}

async function loadAnnouncementTeamLevelsForCoach(coachId, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">Seleccione un nivel...</option>`;

  if (!coachId) return;
  try {
    const res = await fetch(
      `${API_URL}/admin/coach-assignments/coach/${coachId}?active_only=true`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");
    const options = data
      .map(
        (a) =>
          `<option value="${a.level_id}">${a.academy_name} / ${a.category_name} / ${a.level_name}</option>`
      )
      .join("");
    sel.innerHTML = `<option value="">Seleccione un nivel...</option>` + options;
  } catch (e) {
    sel.innerHTML = `<option value="">Error cargando niveles</option>`;
  }
}

async function createAnnouncement(roleKey) {
  const title = document.getElementById(`${roleKey}AnnTitle`)?.value.trim();
  const message = document.getElementById(`${roleKey}AnnMessage`)?.value.trim();
  const priority = document.getElementById(`${roleKey}AnnPriority`)?.value || "normal";
  const scope = document.getElementById(`${roleKey}AnnScope`)?.value || "academy";
  const msg = document.getElementById(`${roleKey}AnnMsg`);

  if (msg) msg.textContent = "";

  if (!title || !message) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Titulo y mensaje son obligatorios.";
    }
    return;
  }

  const target = { scope };
  if (scope === "academy") {
    target.academy_id = Number(document.getElementById(`${roleKey}AnnAcademy`)?.value || "");
  } else if (scope === "category") {
    target.category_id = Number(document.getElementById(`${roleKey}AnnCategory`)?.value || "");
  } else if (scope === "level") {
    target.level_id = Number(document.getElementById(`${roleKey}AnnLevel`)?.value || "");
  } else if (scope === "team") {
    target.level_id = Number(document.getElementById(`${roleKey}AnnTeamLevel`)?.value || "");
    if (roleKey === "admin") {
      target.coach_user_id = Number(document.getElementById(`${roleKey}AnnCoach`)?.value || "");
    } else {
      target.coach_user_id = getUserId();
    }
  }

  const missing =
    (scope === "academy" && !target.academy_id) ||
    (scope === "category" && !target.category_id) ||
    (scope === "level" && !target.level_id) ||
    (scope === "team" && (!target.level_id || !target.coach_user_id));
  if (missing) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Completa el destino seleccionado.";
    }
    return;
  }

  const filesInput = document.getElementById(`${roleKey}AnnFiles`);
  const files = filesInput ? Array.from(filesInput.files || []) : [];

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("message", message);
    fd.append("priority", priority);
    if (!editingAnnouncementId) {
      fd.append("targets", JSON.stringify([target]));
    }
    files.forEach((f) => fd.append("files", f));

    const url = editingAnnouncementId
      ? `${API_URL}/announcements/${editingAnnouncementId}`
      : `${API_URL}/announcements`;
    const method = editingAnnouncementId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { Authorization: "Bearer " + token },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo enviar el aviso");

    if (msg) {
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = editingAnnouncementId
        ? "Aviso actualizado correctamente."
        : "Aviso enviado correctamente.";
    }

    document.getElementById(`${roleKey}AnnTitle`).value = "";
    document.getElementById(`${roleKey}AnnMessage`).value = "";
    if (filesInput) filesInput.value = "";
    editingAnnouncementId = null;

    await loadAnnouncements(roleKey);
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

function openEditAnnouncement(roleKey, ann) {
  editingAnnouncementId = ann.id;
  document.getElementById(`${roleKey}AnnTitle`).value = ann.title || "";
  document.getElementById(`${roleKey}AnnMessage`).value = ann.message || "";
  document.getElementById(`${roleKey}AnnPriority`).value = ann.priority || "normal";
  const msg = document.getElementById(`${roleKey}AnnMsg`);
  if (msg) msg.textContent = "";
}

async function retireAnnouncement(roleKey, id) {
  const ok = await showConfirmModal("\u00bfRetirar este aviso?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/announcements/${id}/retire`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo retirar el aviso");
    await loadAnnouncements(roleKey);
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function deleteAnnouncementAttachment(attachmentId, roleKey) {
  const ok = await showConfirmModal("\u00bfEliminar este adjunto?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/announcements/attachments/${attachmentId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo eliminar el adjunto");
    await loadAnnouncements(roleKey);
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function loadAnnouncements(roleKey) {
  const listId =
    roleKey === "admin"
      ? "adminAnnouncementsList"
      : roleKey === "coach"
      ? "coachAnnouncementsList"
      : "generalAnnouncementsList";
  const box = document.getElementById(listId);
  if (!box) return;

  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando avisos...</div>`;
  try {
    const res = await fetch(`${API_URL}/announcements/my`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los avisos");
    announcementsCache = data;
    renderAnnouncements(listId);
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function renderAnnouncements(listId) {
  const box = document.getElementById(listId);
  if (!box) return;

  if (!announcementsCache.length) {
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay avisos.</div>`;
    return;
  }

  const roleKey = listId.startsWith("admin")
    ? "admin"
    : listId.startsWith("coach")
    ? "coach"
    : "general";

  const pageItems = paginateList(announcementsCache, `announcements_${listId}`, listId, () => loadAnnouncements(roleKey));

  box.innerHTML = pageItems
    .map((a) => {
      const targets = (a.targets || []).map(formatAnnouncementTarget).join(" �?� ");
      const canEdit =
        (role === "admin") || (role === "coach" && a.created_by_user_id === getUserId());
      const attachments = (a.attachments || [])
        .map((att) => {
          const removeBtn = canEdit
            ? `<button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick='deleteAnnouncementAttachment(${att.id}, "${roleKey}")'>
                Eliminar
              </button>`
            : "";
          return `<span class="w3-margin-right">
            <a href="${API_URL}${att.file_url}" target="_blank">${att.file_name}</a>${removeBtn}
          </span>`;
        })
        .join(" ");
      const attachmentBlock = attachments
        ? `<div class="w3-small w3-text-gray">Adjuntos: ${attachments}</div>`
        : "";
      const statusTag = a.is_active === false
        ? `<span class="w3-tag w3-round-xxlarge w3-light-gray w3-tiny w3-margin-left">Retirado</span>`
        : "";
      const actions =
        roleKey !== "general" && canEdit
          ? `<div class="w3-margin-top">
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
                onclick='openEditAnnouncement("${roleKey}", ${JSON.stringify(a)})'>
                Editar
              </button>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick='retireAnnouncement("${roleKey}", ${a.id})'>
                Retirar
              </button>
            </div>`
          : "";
      const priorityBadge = a.priority === "high"
        ? `<span class="w3-tag w3-round-xxlarge w3-red w3-tiny" style="font-size:10px;">Alta</span>`
        : a.priority === "low"
        ? `<span class="w3-tag w3-round-xxlarge w3-light-gray w3-tiny" style="font-size:10px;">Baja</span>`
        : `<span class="w3-tag w3-round-xxlarge w3-blue w3-tiny" style="font-size:10px;">Media</span>`;
      return `
      <div class="w3-card-2 w3-round-large w3-margin-bottom" style="overflow:hidden;">
        <div style="border-left:4px solid ${a.priority === 'high' ? '#EF4444' : a.priority === 'low' ? '#9CA3AF' : '#3B82F6'}; padding:16px 20px;">
          <div class="w3-row">
            <div class="w3-col s12 m8">
              <div style="font-weight:600; font-size:15px; color:#1f2937;">${a.title}</div>
              <div style="margin-top:4px;">
                ${priorityBadge}
                ${statusTag}
                <span class="w3-small w3-text-gray" style="margin-left:6px;">${targets || ""}</span>
              </div>
            </div>
            <div class="w3-col s12 m4 w3-right-align w3-small w3-text-gray" style="padding-top:4px;">
              ${a.created_at ? new Date(a.created_at).toLocaleDateString("es-ES", {year:"numeric", month:"short", day:"numeric"}) : ""}
            </div>
          </div>
          <div style="margin-top:12px; font-size:14px; line-height:1.6; color:#374151; text-align:justify; white-space:pre-line;">${a.message}</div>
          ${attachmentBlock}
          ${actions}
        </div>
      </div>
    `;
    })
    .join("");
}

async function getLevelLabelMap() {
  // Only skip if ALL maps are already populated
  if (levelLabelMap && levelColorMap && categoryColorMap && Object.keys(levelColorMap).length > 0) {
    return levelLabelMap;
  }

  const map = {};
  const colorMap = {};
  const catColorMap = {};       // category_id → { color, name }
  const lvlToCatMap = {};       // level_id → category_id
  let categoryIndex = 0;

  // Pre-defined palette of distinct, accessible colors (up to 12).
  // Falls back to golden-angle HSL for additional categories.
  const CATEGORY_PALETTE = [
    "hsl(210, 70%, 50%)",  // blue
    "hsl(130, 55%, 42%)",  // green
    "hsl(350, 70%, 50%)",  // red
    "hsl(45,  85%, 48%)",  // amber/yellow
    "hsl(280, 60%, 50%)",  // purple
    "hsl(180, 55%, 42%)",  // teal
    "hsl(15,  75%, 50%)",  // orange
    "hsl(320, 60%, 50%)",  // pink
    "hsl(90,  50%, 42%)",  // lime
    "hsl(240, 55%, 55%)",  // indigo
    "hsl(60,  70%, 42%)",  // olive
    "hsl(0,   0%, 50%)",   // gray
  ];

  function getCategoryColor(index) {
    if (index < CATEGORY_PALETTE.length) return CATEGORY_PALETTE[index];
    // Fallback: golden-angle spread
    const hue = (index * 137) % 360;
    return `hsl(${hue}, 65%, 48%)`;
  }

  try {
    const res = await fetch(`${API_URL}/academies/`, { headers: authHeaders() });
    const academies = await res.json();
    if (!res.ok) throw new Error(academies.detail || "No se pudieron cargar academias");

    for (const academy of academies) {
      const catRes = await fetch(
        `${API_URL}/categories/?academy_id=${academy.id}`,
        { headers: authHeaders() }
      );
      const categories = await catRes.json();
      if (!catRes.ok) continue;

      for (const category of categories) {
        // Assign one distinct color per category
        if (!catColorMap[category.id]) {
          const color = getCategoryColor(categoryIndex++);
          catColorMap[category.id] = { color, name: category.name };
        }
        const catColor = catColorMap[category.id].color;

        const lvlRes = await fetch(
          `${API_URL}/levels/?category_id=${category.id}`,
          { headers: authHeaders() }
        );
        const levels = await lvlRes.json();
        if (!lvlRes.ok) continue;

        levels.forEach((level) => {
          map[level.id] = `${academy.name} / ${category.name} / ${level.name}`;
          colorMap[level.id] = catColor;        // same color for all levels in this category
          lvlToCatMap[level.id] = category.id;  // reverse lookup
        });
      }
    }
  } catch (e) {
    levelLabelMap = {};
    levelColorMap = {};
    categoryColorMap = {};
    levelToCategoryMap = {};
    return levelLabelMap;
  }

  levelLabelMap = map;
  levelColorMap = colorMap;
  categoryColorMap = catColorMap;
  levelToCategoryMap = lvlToCatMap;
  return levelLabelMap;
}

function renderReportWithFilters(scope, rows) {
  const filterId = (suffix) => `${scope}Report${suffix}`;
  const filtersHtml = `
    <div class="w3-padding-small w3-border w3-round-xxlarge w3-margin-bottom">
      <div class="w3-row-padding" style="margin:0 -8px">
        <div class="w3-col s12 m4">
          <label class="w3-small w3-text-gray">Buscar</label>
          <input id="${filterId("Search")}" class="w3-input w3-border w3-round-large" placeholder="Academia, nivel, coach o deportista">
        </div>
        <div class="w3-col s12 m4">
          <label class="w3-small w3-text-gray">Nivel</label>
          <select id="${filterId("Level")}" class="w3-select w3-border w3-round-large">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="w3-col s12 m4">
          <label class="w3-small w3-text-gray">Deportista</label>
          <select id="${filterId("Athlete")}" class="w3-select w3-border w3-round-large">
            <option value="">Todos</option>
          </select>
        </div>
      </div>
      <div class="w3-row-padding w3-margin-top" style="margin:0 -8px">
        <div class="w3-col s12 m4"></div>
      </div>
    </div>
  `;
  const table = renderReportTable(rows, scope);
  setTimeout(() => initReportFilters(scope, rows), 0);
  return filtersHtml + table;
}

function renderReportTable(rows, scope) {
  const header = `
    <table class="w3-table-all w3-small w3-round-xxlarge">
      <thead>
        <tr class="w3-light-gray">
          <th>Academia</th>
          <th>Categoría</th>
          <th>Nivel</th>
          <th>Coach</th>
          <th>Deportista</th>
          <th>Presente</th>
          <th>Ausente</th>
          <th>Justificado</th>
        </tr>
      </thead>
      <tbody id="${scope ? scope + "ReportBody" : "reportBody"}">
  `;
  const body = rows
    .map(
      (r) => `
      <tr>
        <td>${r.academy_name || "-"}</td>
        <td>${r.category_name || "-"}</td>
        <td>${r.level_name || "-"}</td>
        <td>${r.coach_name || "-"}</td>
        <td>${r.athlete_name || "-"}</td>
        <td>${r.present_count}</td>
        <td>${r.absent_count}</td>
        <td>${r.justified_count}</td>
      </tr>
    `
    )
    .join("");
  return header + body + "</tbody></table>";
}

function getReportFilteredData(scope) {
  const data = scope === "admin" ? adminReportCache : scope === "coach" ? coachReportCache : generalReportCache;
  const filters = getReportFilterValues(scope);
  return applyReportFilters(data, filters);
}

function exportReportCsv(scope) {
  const data = getReportFilteredData(scope);
  if (!data.length) return;
  const headers = [
    "Academia",
    "Categoria",
    "Nivel",
    "Coach",
    "Deportista",
    "Presente",
    "Ausente",
    "Justificado",
  ];
  const rows = data.map((r) => [
    r.academy_name || "",
    r.category_name || "",
    r.level_name || "",
    r.coach_name || "",
    r.athlete_name || "",
    r.present_count,
    r.absent_count,
    r.justified_count,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_asistencia_${scope}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportReportPdf(scope) {
  const data = getReportFilteredData(scope);
  if (!data.length) return;
  const html = `
    <html>
      <head>
        <title>Reporte de asistencia</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; }
          h2 { margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
          th { background: #f0f0f0; }
        </style>
      </head>
      <body>
        <h2>Reporte de asistencia</h2>
        ${renderReportTable(data, "export")}
      </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}


function formatAthleteGender(value) {
  if (value === "M") return "Masculino";
  if (value === "F") return "Femenino";
  return value || "-";
}

function getFilteredAthletesForExport(scope) {
  const prefix = scope === "coach" ? "coach" : "admin";
  const cache = scope === "coach" ? coachAthletesCache : adminAthletesCache;
  const filters = getFilterValues(prefix);
  const filtered = cache.filter((a) => athleteMatchesFilters(a, filters));
  return { filters, filtered };
}

function getFilteredAssignmentsForExport(assignments, filters) {
  const list = assignments || [];
  const assignmentFilters = [
    ["academy_id", filters.academyId],
    ["category_id", filters.categoryId],
    ["level_id", filters.levelId],
    ["coach_user_id", filters.coachId],
  ].filter(([, v]) => v);
  if (!assignmentFilters.length) return list;
  return list.filter((as) =>
    assignmentFilters.every(([key, value]) => String(as[key] || "") === String(value))
  );
}

function formatAssignmentsForExport(a, filters) {
  const assignments = getFilteredAssignmentsForExport(a.assignments || [], filters);
  if (!assignments.length) return "-";
  return assignments
    .map((as) => {
      const coach = as.coach_name ? ` (Coach: ${as.coach_name})` : "";
      return `${as.academy_name || "-"} / ${as.category_name || "-"} / ${as.level_name || "-"}${coach}`;
    })
    .join("; ");
}

function exportAthletesCsv(scope) {
  const { filters, filtered } = getFilteredAthletesForExport(scope);
  if (!filtered.length) {
    if (typeof showAlertModal === "function") showAlertModal("No hay datos para exportar.");
    else showAlertModal("No hay datos para exportar.");
    return;
  }
  const headers = [
    "Nombre",
    "Identificaci\u00f3n",
    "G\u00e9nero",
    "Nacimiento",
    "Edad",
    "Altura (cm)",
    "Peso (kg)",
    "Disciplina",
    "Asignaciones",
  ];
  const rows = filtered.map((a) => {
    const birth = a.birth_date ? formatBirth(a.birth_date) : "";
    const age = computeAge(a.birth_date);
    return [
      `${a.first_name || ""} ${a.last_name || ""}`.trim(),
      a.id_number || "",
      formatAthleteGender(a.gender),
      birth,
      age === null ? "" : age,
      a.height_cm || "",
      a.weight_kg || "",
      a.discipline || "",
      formatAssignmentsForExport(a, filters),
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `reporte_deportistas_${scope}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAthletesPdf(scope) {
  const { filters, filtered } = getFilteredAthletesForExport(scope);
  if (!filtered.length) {
    if (typeof showAlertModal === "function") showAlertModal("No hay datos para exportar.");
    else showAlertModal("No hay datos para exportar.");
    return;
  }
  const rows = filtered
    .map((a) => {
      const birth = a.birth_date ? formatBirth(a.birth_date) : "-";
      const age = computeAge(a.birth_date);
      const assignments = formatAssignmentsForExport(a, filters);
      return `
        <tr>
          <td>${a.first_name || ""} ${a.last_name || ""}</td>
          <td>${a.id_number || "-"}</td>
          <td>${formatAthleteGender(a.gender)}</td>
          <td>${birth}</td>
          <td>${age === null ? "-" : age}</td>
          <td>${a.height_cm || "-"}</td>
          <td>${a.weight_kg || "-"}</td>
          <td>${a.discipline || "-"}</td>
          <td>${assignments}</td>
        </tr>
      `;
    })
    .join("");
  const html = `
    <html>
      <head>
        <title>Reporte de deportistas</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; }
          h2 { margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f0f0f0; }
        </style>
      </head>
      <body>
        <h2>Reporte de deportistas</h2>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Identificaci\u00f3n</th>
              <th>G\u00e9nero</th>
              <th>Nacimiento</th>
              <th>Edad</th>
              <th>Altura</th>
              <th>Peso</th>
              <th>Disciplina</th>
              <th>Asignaciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function initReportFilters(scope, rows) {
  const setOptions = (id, values) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML =
      `<option value="">Todos</option>` +
      values
        .filter(Boolean)
        .sort()
        .map((v) => `<option value="${v}">${v}</option>`)
        .join("");
    if (current) sel.value = current;
  };

  setOptions(`${scope}ReportLevel`, rows.map((r) => r.level_name));
  setOptions(`${scope}ReportAthlete`, rows.map((r) => r.athlete_name));

  const attach = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const event = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(event, () => updateReportTable(scope));
  };

  attach(`${scope}ReportSearch`);
  attach(`${scope}ReportLevel`);
  attach(`${scope}ReportAthlete`);
}

function getReportFilterValues(scope) {
  const getVal = (suffix) => document.getElementById(`${scope}Report${suffix}`)?.value || "";
  return {
    search: getVal("Search").trim().toLowerCase(),
    level: getVal("Level"),
    athlete: getVal("Athlete"),
  };
}

function applyReportFilters(data, filters) {
  return data.filter((r) => {
    const haystack = [
      r.academy_name,
      r.category_name,
      r.level_name,
      r.coach_name,
      r.athlete_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (filters.search && !haystack.includes(filters.search)) return false;
    if (filters.level && r.level_name !== filters.level) return false;
    if (filters.athlete && r.athlete_name !== filters.athlete) return false;
    return true;
  });
}

function updateReportTable(scope) {
  const data = getReportFilteredData(scope);
  const body = document.getElementById(`${scope}ReportBody`);
  if (!body) return;
  body.innerHTML = data
    .map(
      (r) => `
    <tr>
      <td>${r.academy_name || "-"}</td>
      <td>${r.category_name || "-"}</td>
      <td>${r.level_name || "-"}</td>
      <td>${r.coach_name || "-"}</td>
      <td>${r.athlete_name || "-"}</td>
      <td>${r.present_count}</td>
      <td>${r.absent_count}</td>
      <td>${r.justified_count}</td>
    </tr>
  `
    )
    .join("");
}

async function loadCoachTrainingSessions() {
  const calendar = document.getElementById("coachSessionCalendar");
  if (!calendar) return;

  calendar.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando sesiones…</div>`;
  try {
    ensureCoachCalendar();
    coachCalendarMonth = coachCalendar.getDate();
    const { startDate, endDate } = getMonthRange(coachCalendarMonth);
    const res = await fetch(
      `${API_URL}/training-sessions/my?start_date=${startDate}&end_date=${endDate}`,
      { headers: authHeaders() }
    );
    const sessions = await res.json();
    if (!res.ok) throw new Error(sessions.detail || "No se pudieron cargar las sesiones");

    cacheSessions(sessions);
    const labelMap = await getLevelLabelMap();
    setCalendarEvents(coachCalendar, sessions, labelMap);
  } catch (e) {
    calendar.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function getMonthRange(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const toDate = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  };
  return { startDate: toDate(start), endDate: toDate(end) };
}

function updateCalendarLabel(labelId, dateObj) {
  const label = document.getElementById(labelId);
  if (!label) return;
  const formatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
  label.textContent = formatter.format(dateObj);
}

function ensureAdminCalendar() {
  if (adminCalendar) return;
  const el = document.getElementById("adminSessionCalendar");
  if (!el || !window.FullCalendar) return;

  adminCalendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    firstDay: 1,
    locale: "es",
    headerToolbar: false,
    eventClick: (info) => {
      const sessionId = info.event.extendedProps.sessionId;
      if (sessionId) openAttendance(sessionId);
    },
    eventContent: (arg) => {
      const timeText = formatCalendarTimeRange(arg.event.start, arg.event.end);
      return {
        html: `
          <div class="w3-small">
            <div class="fc-time">${timeText}</div>
            <button class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny fc-attendance-btn">
              Asistencia
            </button>
            <button class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny fc-edit-btn" style="margin-left:6px">
              Editar
            </button>
          </div>
        `,
      };
    },
    eventDidMount: (info) => {
      // Force-apply category background color (CSS may override FC inline styles)
      const bgColor = info.event.backgroundColor;
      if (bgColor) {
        info.el.style.backgroundColor = bgColor;
        info.el.style.borderColor = bgColor;
      }
      const levels = info.event.extendedProps.levelLabels || "";
      const timeText = formatCalendarTimeRange(info.event.start, info.event.end);
      const tooltip = levels ? `${timeText} | ${levels}` : timeText;
      attachCalendarTooltip(info.el, tooltip);
      const btn = info.el.querySelector(".fc-attendance-btn");
      if (!btn) return;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const sessionId = info.event.extendedProps.sessionId;
        if (sessionId) openAttendance(sessionId);
      });
      attachCalendarTooltip(btn, tooltip);
      const editBtn = info.el.querySelector(".fc-edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const sessionId = info.event.extendedProps.sessionId;
          if (sessionId) openEditSession(sessionId);
        });
      }
    },
    datesSet: (info) => {
      const label = document.getElementById("adminCalendarLabel");
      if (label) label.textContent = info.view.title;
    },
  });
  adminCalendar.render();
}

function ensureCoachCalendar() {
  if (coachCalendar) return;
  const el = document.getElementById("coachSessionCalendar");
  if (!el || !window.FullCalendar) return;

  coachCalendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    firstDay: 1,
    locale: "es",
    headerToolbar: false,
    eventClick: (info) => {
      const sessionId = info.event.extendedProps.sessionId;
      if (sessionId) openAttendance(sessionId);
    },
    eventContent: (arg) => {
      const timeText = formatCalendarTimeRange(arg.event.start, arg.event.end);
      return {
        html: `
          <div class="w3-small">
            <div class="fc-time">${timeText}</div>
            <button class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny fc-attendance-btn">
              Asistencia
            </button>
          </div>
        `,
      };
    },
    eventDidMount: (info) => {
      // Force-apply category background color (CSS may override FC inline styles)
      const bgColor = info.event.backgroundColor;
      if (bgColor) {
        info.el.style.backgroundColor = bgColor;
        info.el.style.borderColor = bgColor;
      }
      const levels = info.event.extendedProps.levelLabels || "";
      const timeText = formatCalendarTimeRange(info.event.start, info.event.end);
      const tooltip = levels ? `${timeText} | ${levels}` : timeText;
      attachCalendarTooltip(info.el, tooltip);
      const btn = info.el.querySelector(".fc-attendance-btn");
      if (!btn) return;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const sessionId = info.event.extendedProps.sessionId;
        if (sessionId) openAttendance(sessionId);
      });
      attachCalendarTooltip(btn, tooltip);
    },
    datesSet: (info) => {
      const label = document.getElementById("coachCalendarLabel");
      if (label) label.textContent = info.view.title;
    },
  });
  coachCalendar.render();
}

function setCalendarEvents(calendarInstance, sessions, labelMap) {
  if (!calendarInstance) return;

  const DEFAULT_COLOR = "hsl(0, 0%, 65%)"; // neutral gray for sessions without category
  const usedCategoryIds = new Set();

  const events = sessions.map((s) => {
    // Determine color from the category of the first level_id
    let bgColor = DEFAULT_COLOR;
    if (s.level_ids && s.level_ids.length > 0 && levelColorMap) {
      bgColor = levelColorMap[s.level_ids[0]] || DEFAULT_COLOR;
      // Track which categories are visible this month
      const catId = levelToCategoryMap[s.level_ids[0]];
      if (catId) usedCategoryIds.add(catId);
    }
    return {
      id: String(s.id),
      start: s.start_datetime,
      end: s.end_datetime,
      backgroundColor: bgColor,
      borderColor: bgColor,
      extendedProps: {
        sessionId: s.id,
        seriesId: s.series_id || null,
        levelLabels: formatLevelLabels(s.level_ids, labelMap),
      },
    };
  });
  calendarInstance.removeAllEvents();
  calendarInstance.addEventSource(events);

  // Render color legend next to this calendar
  const calEl = calendarInstance.el;
  renderCategoryLegend(calEl, usedCategoryIds);
}

/**
 * Render a small color legend below the calendar showing
 * which color corresponds to each category.
 */
function renderCategoryLegend(calendarEl, usedCategoryIds) {
  // Find or create the legend container right after the calendar element
  let legend = calendarEl.parentElement.querySelector(".calendar-category-legend");
  if (!legend) {
    legend = document.createElement("div");
    legend.className = "calendar-category-legend";
    calendarEl.parentElement.insertBefore(legend, calendarEl.nextSibling);
  }

  if (!usedCategoryIds || usedCategoryIds.size === 0) {
    legend.innerHTML = "";
    return;
  }

  const items = [...usedCategoryIds].map((catId) => {
    const cat = categoryColorMap[catId];
    if (!cat) return "";
    return `
      <span style="display:inline-flex;align-items:center;margin-right:14px;margin-bottom:4px">
        <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${cat.color};margin-right:5px;flex-shrink:0"></span>
        <span class="w3-small">${cat.name}</span>
      </span>`;
  }).join("");

  legend.innerHTML = `<div style="display:flex;flex-wrap:wrap;padding:6px 0">${items}</div>`;
}

function formatCalendarTimeRange(start, end) {
  if (!start) return "";
  const formatTime = (d) =>
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  const startText = formatTime(start);
  const endText = end ? formatTime(end) : "";
  return endText ? `${startText} - ${endText}` : startText;
}

function formatLevelLabels(levelIds, labelMap) {
  if (!levelIds || !levelIds.length || !labelMap) return "";
  const labels = levelIds
    .map((id) => labelMap[id])
    .filter(Boolean);
  if (!labels.length) return "";
  return labels.join(" | ");
}

function cacheSessions(sessions) {
  if (!sessions || !sessions.length) return;
  sessions.forEach((s) => {
    sessionCache[s.id] = s; // includes series_id from backend
  });
}

function formatSessionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function cancelInvoice(invoiceId) {
  const ok = await showConfirmModal("\u00bfCancelar esta factura?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/billing/invoices/${invoiceId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "cancelled" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo cancelar la factura");
    await loadAdminInvoices();
  } catch (e) {
    showAlertModal(e.message);
  }
}

let calendarTooltipEl = null;

function ensureCalendarTooltip() {
  if (calendarTooltipEl) return calendarTooltipEl;
  const el = document.createElement("div");
  el.className = "calendar-tooltip";
  document.body.appendChild(el);
  calendarTooltipEl = el;
  return el;
}

function attachCalendarTooltip(targetEl, text) {
  if (!targetEl || !text) return;
  const tooltip = ensureCalendarTooltip();

  const show = (event) => {
    tooltip.textContent = text;
    tooltip.style.display = "block";
    positionTooltip(event);
  };

  const hide = () => {
    tooltip.style.display = "none";
  };

  const move = (event) => {
    positionTooltip(event);
  };

  const positionTooltip = (event) => {
    const pad = 12;
    const x = event.clientX + pad;
    const y = event.clientY + pad;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  };

  targetEl.addEventListener("mouseenter", show);
  targetEl.addEventListener("mousemove", move);
  targetEl.addEventListener("mouseleave", hide);
}

function renderCalendar(containerId, sessions, monthDate) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const getMondayIndex = (y, m) => {
    const dow = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0=Sun..6=Sat
    return (dow + 6) % 7; // monday=0
  };
  const startWeekDay = getMondayIndex(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionsByDay = {};
  sessions.forEach((s) => {
    const d = new Date(s.start_datetime);
    const key = d.getDate();
    if (!sessionsByDay[key]) sessionsByDay[key] = [];
    sessionsByDay[key].push(s);
  });

  const dayLabels = ["L", "M", "X", "J", "V", "S", "D"];
  let html = `<div class="w3-row w3-small w3-text-gray">` +
    dayLabels.map((d) => `<div class="w3-col s1 m1" style="width:14.28%">${d}</div>`).join("") +
    `</div>`;

  html += `<div class="w3-row">`;
  for (let i = 0; i < startWeekDay; i++) {
    html += `<div class="w3-col s1 m1" style="width:14.28%"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const daySessions = sessionsByDay[day] || [];
    html += `
      <div class="w3-col s1 m1" style="width:14.28%">
        <div class="w3-border w3-round-large w3-padding-small" style="min-height:96px">
          <div class="w3-small w3-text-gray">${day}</div>
          ${daySessions
            .map((s) => {
              const start = formatSessionTime(s.start_datetime);
              const end = formatSessionTime(s.end_datetime);
              return `
                <div class="w3-small w3-margin-top">
                  ${start}${end ? " - " + end : ""}
                  <button
                    class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                    onclick="openAttendance(${s.id})">
                    Asistencia
                  </button>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function formatSessionTime(value) {
  if (!value) return "";
  const parts = String(value).split("T");
  if (parts.length < 2) return "";
  const timePart = parts[1].split(".")[0];
  return timePart.slice(0, 5);
}

function adminPrevMonth() {
  if (adminCalendar) {
    adminCalendar.prev();
    loadAdminTrainingSessions();
    return;
  }
  adminCalendarMonth = new Date(adminCalendarMonth.getFullYear(), adminCalendarMonth.getMonth() - 1, 1);
  loadAdminTrainingSessions();
}

function adminNextMonth() {
  if (adminCalendar) {
    adminCalendar.next();
    loadAdminTrainingSessions();
    return;
  }
  adminCalendarMonth = new Date(adminCalendarMonth.getFullYear(), adminCalendarMonth.getMonth() + 1, 1);
  loadAdminTrainingSessions();
}

function coachPrevMonth() {
  if (coachCalendar) {
    coachCalendar.prev();
    loadCoachTrainingSessions();
    return;
  }
  coachCalendarMonth = new Date(coachCalendarMonth.getFullYear(), coachCalendarMonth.getMonth() - 1, 1);
  loadCoachTrainingSessions();
}

function coachNextMonth() {
  if (coachCalendar) {
    coachCalendar.next();
    loadCoachTrainingSessions();
    return;
  }
  coachCalendarMonth = new Date(coachCalendarMonth.getFullYear(), coachCalendarMonth.getMonth() + 1, 1);
  loadCoachTrainingSessions();
}

async function openCreateSession() {
  const modal = document.getElementById("modalCreateSession");
  const msg = document.getElementById("tsMsg");
  if (!modal || !msg) return;

  editingSessionId = null;
  document.getElementById("tsStart").value = "";
  document.getElementById("tsEnd").value = "";
  document.getElementById("tsNotes").value = "";
  document.getElementById("tsFrequency").value = "none";
  document.getElementById("tsUntil").value = "";
  msg.textContent = "";

  await loadAllActiveLevels();
  handleFrequencyChange();
  updateSessionModalState(false);

  modal.style.display = "block";
}

async function openEditSession(sessionId) {
  const session = sessionCache[sessionId];
  if (!session) return;
  const modal = document.getElementById("modalCreateSession");
  const msg = document.getElementById("tsMsg");
  if (!modal || !msg) return;

  editingSessionId = sessionId;
  document.getElementById("tsStart").value = toLocalInput(session.start_datetime);
  document.getElementById("tsEnd").value = toLocalInput(session.end_datetime);
  document.getElementById("tsNotes").value = session.notes || "";
  document.getElementById("tsFrequency").value = "none";
  document.getElementById("tsUntil").value = "";
  msg.textContent = "";

  await loadAllActiveLevels();
  setSelectedLevels(session.level_ids || []);
  handleFrequencyChange();
  updateSessionModalState(true);

  modal.style.display = "block";
}

function updateSessionModalState(isEdit) {
  const cancelBtn = document.getElementById("tsCancelSessionBtn");
  const cancelSeriesBtn = document.getElementById("tsCancelSeriesBtn");
  const saveBtn = document.getElementById("tsSaveBtn");
  if (cancelBtn) cancelBtn.style.display = isEdit ? "inline-block" : "none";
  if (saveBtn) saveBtn.textContent = isEdit ? "Actualizar" : "Guardar";

  // Show "Cancelar serie" only if editing a session that belongs to a series
  if (cancelSeriesBtn) {
    const session = editingSessionId ? sessionCache[editingSessionId] : null;
    cancelSeriesBtn.style.display = (isEdit && session && session.series_id) ? "inline-block" : "none";
  }
}

function setSelectedLevels(levelIds) {
  const ids = new Set((levelIds || []).map((id) => Number(id)));
  document.querySelectorAll(".tsLevelOption").forEach((el) => {
    el.checked = ids.has(Number(el.value));
  });
  // Trigger category lock based on restored selection
  handleLevelCategoryLock();
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function closeCreateSession() {
  const modal = document.getElementById("modalCreateSession");
  if (modal) modal.style.display = "none";
}

function handleFrequencyChange() {
  const freq = document.getElementById("tsFrequency").value;
  const wrap = document.getElementById("tsWeekdaysWrap");
  if (!wrap) return;
  if (freq === "weekly") wrap.classList.remove("w3-hide");
  else wrap.classList.add("w3-hide");
}

function handleAllLevelsToggle() {
  // No-op: "all levels" option removed in favor of single-category selection
}

function toggleLevelDropdown() {
  const dropdown = document.getElementById("tsLevelDropdown");
  if (!dropdown) return;
  dropdown.classList.toggle("w3-hide");
}

async function loadAllActiveLevels() {
  const list = document.getElementById("tsLevelList");
  if (!list) return;
  list.innerHTML = "";

  try {
    const resAcad = await fetch(`${API_URL}/academies/`, { headers: authHeaders() });
    const academies = await resAcad.json();
    if (!resAcad.ok) throw new Error(academies.detail || "Error cargando academias");

    // Build grouped structure: category → levels
    const groups = []; // { catId, catName, acadName, levels: [{id,name}] }
    for (const acad of academies) {
      const resCat = await fetch(`${API_URL}/categories/?academy_id=${acad.id}`, { headers: authHeaders() });
      const categories = await resCat.json();
      if (!resCat.ok) throw new Error(categories.detail || "Error cargando categorías");
      for (const cat of categories) {
        const resLvl = await fetch(`${API_URL}/levels/?category_id=${cat.id}`, { headers: authHeaders() });
        const levels = await resLvl.json();
        if (!resLvl.ok) throw new Error(levels.detail || "Error cargando niveles");
        if (levels.length) {
          groups.push({
            catId: cat.id,
            catName: cat.name,
            acadName: acad.name,
            levels,
          });
        }
      }
    }

    // Render grouped by category with a header per group
    let html = "";
    for (const g of groups) {
      html += `<div class="w3-margin-bottom" data-cat-group="${g.catId}">`;
      html += `<div class="w3-small w3-text-gray" style="font-weight:600;margin-bottom:2px">${g.acadName} / ${g.catName}</div>`;
      for (const lvl of g.levels) {
        html += `
          <label class="w3-small" style="display:block;margin-bottom:3px;padding-left:12px">
            <input type="checkbox" class="tsLevelOption" value="${lvl.id}" data-category-id="${g.catId}"
                   onchange="handleLevelCategoryLock()"> ${lvl.name}
          </label>`;
      }
      html += `</div>`;
    }
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="w3-small w3-text-red">${e.message}</div>`;
  }
}

/**
 * When a level checkbox is checked, disable all levels from OTHER categories.
 * When all are unchecked, re-enable everything.
 */
function handleLevelCategoryLock() {
  const allBoxes = document.querySelectorAll(".tsLevelOption");
  const checked = [...allBoxes].filter((el) => el.checked);

  if (checked.length === 0) {
    // Nothing selected → enable all
    allBoxes.forEach((el) => {
      el.disabled = false;
      el.closest("label").style.opacity = "1";
    });
    // Re-enable all category group headers
    document.querySelectorAll("[data-cat-group]").forEach((g) => g.style.opacity = "1");
    return;
  }

  // Get the category of the first checked level
  const activeCatId = checked[0].dataset.categoryId;

  allBoxes.forEach((el) => {
    if (el.dataset.categoryId === activeCatId) {
      el.disabled = false;
      el.closest("label").style.opacity = "1";
    } else {
      el.disabled = true;
      el.checked = false;
      el.closest("label").style.opacity = "0.4";
    }
  });

  // Dim entire category groups that are locked out
  document.querySelectorAll("[data-cat-group]").forEach((g) => {
    g.style.opacity = g.dataset.catGroup === activeCatId ? "1" : "0.5";
  });
}

async function saveCreateSession() {
  const msg = document.getElementById("tsMsg");
  if (!msg) return;
  msg.textContent = "";

  const start = document.getElementById("tsStart").value;
  const end = document.getElementById("tsEnd").value;
  const notes = document.getElementById("tsNotes").value.trim();
  const allLevels = false; // levels are now restricted to one category
  const frequency = document.getElementById("tsFrequency").value;
  const until = document.getElementById("tsUntil").value;

  if (!start || !end) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Debes indicar inicio y fin.";
    return;
  }

  const level_ids = allLevels
    ? []
    : Array.from(document.querySelectorAll(".tsLevelOption"))
        .filter((el) => el.checked)
        .map((el) => Number(el.value));

  if (!allLevels && !level_ids.length) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Debes seleccionar al menos un nivel.";
    return;
  }

  const weekdays = Array.from(document.querySelectorAll(".tsWeekday"))
    .filter((el) => el.checked)
    .map((el) => Number(el.value));

  const payload = {
    start_datetime: start,
    end_datetime: end,
    notes: notes || null,
    all_levels: allLevels,
    level_ids: allLevels ? null : level_ids,
    frequency: editingSessionId ? "none" : frequency,
    weekdays: editingSessionId ? null : frequency === "weekly" ? weekdays : null,
    until_date: editingSessionId ? null : frequency === "none" ? null : until || null,
  };

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const url = editingSessionId
      ? `${API_URL}/training-sessions/${editingSessionId}`
      : `${API_URL}/training-sessions/`;
    const method = editingSessionId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron crear sesiones");
    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = editingSessionId
      ? "Sesion actualizada correctamente."
      : "Sesiones creadas correctamente.";
    await loadAdminTrainingSessions();
    setTimeout(closeCreateSession, 800);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function cancelSession() {
  if (!editingSessionId) return;
  const ok = await showConfirmModal("\u00bfCancelar esta sesi\u00f3n?");
  if (!ok) return;
  const msg = document.getElementById("tsMsg");
  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const res = await fetch(`${API_URL}/training-sessions/${editingSessionId}/cancel`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo cancelar la sesion");
    await loadAdminTrainingSessions();
    closeCreateSession();
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

async function cancelSeries() {
  if (!editingSessionId) return;
  const session = sessionCache[editingSessionId];
  if (!session || !session.series_id) return;

  const ok = await showConfirmModal(
    "¿Cancelar TODA la serie de sesiones?\n\n" +
    "Las sesiones con asistencia registrada se protegerán por defecto."
  );
  if (!ok) return;

  const msg = document.getElementById("tsMsg");
  try {
    setStatusMessage(msg, "Cancelando serie…", "w3-small w3-text-gray w3-center");
    const res = await fetch(
      `${API_URL}/training-sessions/series/${session.series_id}/cancel?cancel_with_attendance=false`,
      { method: "PATCH", headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo cancelar la serie");

    let summary = `✅ Serie cancelada: ${data.cancelled} cancelada(s)`;
    if (data.skipped > 0) {
      summary += `, ${data.skipped} protegida(s) (con asistencia)`;
    }
    if (data.already_cancelled > 0) {
      summary += `, ${data.already_cancelled} ya cancelada(s)`;
    }

    setStatusMessage(msg, summary, "w3-small w3-text-green w3-center");
    await loadAdminTrainingSessions();
    setTimeout(closeCreateSession, 2500);
  } catch (e) {
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

async function openAttendance(sessionId) {
  const modal = document.getElementById("modalAttendance");
  const rosterBox = document.getElementById("attendanceRoster");
  const infoBox = document.getElementById("attendanceSessionInfo");
  const msg = document.getElementById("attendanceMsg");
  if (msg) {
    msg.textContent = "";
    msg.className = "w3-small w3-center";
  }
  if (!modal || !rosterBox) return;

  document.getElementById("attendanceSessionId").value = sessionId;
  rosterBox.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando lista…</div>`;
  modal.style.display = "block";

  try {
    const res = await fetch(`${API_URL}/training-sessions/${sessionId}/roster`, {
      headers: authHeaders(),
    });
    const roster = await res.json();
    if (!res.ok) throw new Error(roster.detail || "No se pudo cargar la lista");

    if (!roster.length) {
      rosterBox.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin deportistas asignados.</div>`;
      return;
    }

    const bulkControls = `
      <div class="w3-padding-small w3-border-bottom w3-margin-bottom">
        <span class="w3-small w3-text-gray">Marcar todos:</span>
        <button
          class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
          onclick="setAllAttendance('Presente')">
          Presente
        </button>
        <button
          class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
          onclick="setAllAttendance('Ausente')">
          Ausente
        </button>
        <button
          class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
          onclick="setAllAttendance('Justificado')">
          Justificado
        </button>
      </div>
    `;

    rosterBox.innerHTML =
      bulkControls +
      roster
        .map(
          (r) => `
      <div class="w3-row w3-padding-small w3-border-bottom">
        <div class="w3-col s12 m6">
          <b>${r.full_name}</b><br>
          <span class="w3-small w3-text-gray">${r.id_number || "-"}</span>
        </div>
        <div class="w3-col s12 m6">
          <div class="w3-small w3-margin-top">
            <label class="w3-margin-right">
              <input type="radio" name="att_${r.athlete_id}" value="Presente" ${r.status === "Presente" ? "checked" : ""}>
              Presente
            </label>
            <label class="w3-margin-right">
              <input type="radio" name="att_${r.athlete_id}" value="Ausente" ${r.status === "Ausente" ? "checked" : ""}>
              Ausente
            </label>
            <label>
              <input type="radio" name="att_${r.athlete_id}" value="Justificado" ${r.status === "Justificado" ? "checked" : ""}>
              Justificado
            </label>
          </div>
        </div>
      </div>
      `
        )
        .join("");
  } catch (e) {
    rosterBox.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function closeAttendance() {
  const modal = document.getElementById("modalAttendance");
  const msg = document.getElementById("attendanceMsg");
  if (msg) { msg.textContent = ""; msg.className = "w3-small w3-center"; }
  if (modal) modal.style.display = "none";
}

async function saveAttendance() {
  const sessionId = document.getElementById("attendanceSessionId").value;
  const msg = document.getElementById("attendanceMsg");
  if (!sessionId || !msg) return;
  msg.textContent = "";

  const items = Array.from(document.querySelectorAll("#attendanceRoster input[type='radio']:checked"))
    .map((el) => ({
      athlete_id: Number(el.name.replace("att_", "")),
      status: el.value,
    }));

  if (!items.length) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Selecciona al menos un estado.";
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const res = await fetch(`${API_URL}/training-sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(items),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo guardar la asistencia");
    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = "Asistencia guardada.";
    setTimeout(closeAttendance, 800);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

function setAllAttendance(status) {
  const radios = document.querySelectorAll("#attendanceRoster input[type='radio']");
  radios.forEach((el) => {
    if (el.value === status) {
      el.checked = true;
    }
  });
}

function cancelEditAcademy() {
  editingAcademyId = null;
  const nameEl = document.getElementById("admAcadName");
  const codeEl = document.getElementById("admAcadCode");
  const descEl = document.getElementById("admAcadDesc");
  const btn = document.getElementById("admAcadCreateBtn");
  const cancelBtn = document.getElementById("admAcadCancelBtn");
  if (nameEl) nameEl.value = "";
  if (codeEl) codeEl.value = "";
  if (descEl) descEl.value = "";
  if (btn) btn.textContent = "Guardar academia";
  if (cancelBtn) cancelBtn.style.display = "none";
}

function cancelEditCategory() {
  editingCategoryId = null;
  const nameEl = document.getElementById("admCatName");
  const descEl = document.getElementById("admCatDesc");
  const btn = document.getElementById("admCatCreateBtn");
  const cancelBtn = document.getElementById("admCatCancelBtn");
  if (nameEl) nameEl.value = "";
  if (descEl) descEl.value = "";
  if (btn) btn.textContent = "Guardar categoría";
  if (cancelBtn) cancelBtn.style.display = "none";
}

function cancelEditLevel() {
  editingLevelId = null;
  const nameEl = document.getElementById("admLvlName");
  const descEl = document.getElementById("admLvlDesc");
  const btn = document.getElementById("admLvlCreateBtn");
  const cancelBtn = document.getElementById("admLvlCancelBtn");
  if (nameEl) nameEl.value = "";
  if (descEl) descEl.value = "";
  if (btn) btn.textContent = "Guardar nivel";
  if (cancelBtn) cancelBtn.style.display = "none";
}

function openEditAcademy(academy) {
  editingAcademyId = academy.id;
  const nameEl = document.getElementById("admAcadName");
  const codeEl = document.getElementById("admAcadCode");
  const descEl = document.getElementById("admAcadDesc");
  const btn = document.getElementById("admAcadCreateBtn");
  const cancelBtn = document.getElementById("admAcadCancelBtn");
  if (nameEl) nameEl.value = academy.name || "";
  if (codeEl) codeEl.value = academy.code || "";
  if (descEl) descEl.value = academy.description || "";
  if (btn) btn.textContent = "Actualizar academia";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
}

function openEditCategory(category) {
  editingCategoryId = category.id;
  const academySel = document.getElementById("admCatAcademy");
  const nameEl = document.getElementById("admCatName");
  const descEl = document.getElementById("admCatDesc");
  const btn = document.getElementById("admCatCreateBtn");
  const cancelBtn = document.getElementById("admCatCancelBtn");
  if (academySel) academySel.value = String(category.academy_id || "");
  if (nameEl) nameEl.value = category.name || "";
  if (descEl) descEl.value = category.description || "";
  if (btn) btn.textContent = "Actualizar categoría";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
}

function openEditLevel(level) {
  editingLevelId = level.id;
  const categorySel = document.getElementById("admLvlCategory");
  const nameEl = document.getElementById("admLvlName");
  const descEl = document.getElementById("admLvlDesc");
  const btn = document.getElementById("admLvlCreateBtn");
  const cancelBtn = document.getElementById("admLvlCancelBtn");
  if (categorySel) categorySel.value = String(level.category_id || "");
  if (nameEl) nameEl.value = level.name || "";
  if (descEl) descEl.value = level.description || "";
  if (btn) btn.textContent = "Actualizar nivel";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
}

// --- Academias ---

async function adminReloadAcademiesUI() {
  const list = document.getElementById("admAcadList");
  const selCatAcad = document.getElementById("admCatAcademy");
  const msg = document.getElementById("admAcadMsg");

  if (list)
    list.innerHTML = `<div class="w3-text-gray w3-small">Cargando academias…</div>`;

  try {
    const [resAll, resActive] = await Promise.all([
      fetch(`${API_URL}/academies/admin`, { headers: authHeaders() }),
      fetch(`${API_URL}/academies/`, { headers: authHeaders() }),
    ]);
    const academies = await resAll.json();
    const activeAcademies = await resActive.json();
    if (!resAll.ok) throw new Error(academies.detail || "No se pudieron cargar las academias");
    if (!resActive.ok) throw new Error(activeAcademies.detail || "No se pudieron cargar las academias");

    // Lista (incluye inactivas)
    if (list) {
      if (!academies.length) {
        list.innerHTML = `<div class="w3-text-gray w3-small">No hay academias registradas.</div>`;
      } else {
        const pageItems = paginateList(academies, "adminAcademies", "admAcadList", adminReloadAcademiesUI);

        list.innerHTML = pageItems
          .map((a) => {
            const statusText = a.is_active ? "Activa" : "Inactiva";
            const statusClass = a.is_active ? "w3-text-green" : "w3-text-red";
            const toggleText = a.is_active ? "Inactivar" : "Activar";
            const deleteBtn = !a.is_active
              ? `<button
                  class="w3-button w3-red w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="deleteAcademy(${a.id})">
                  Eliminar
                </button>`
              : "";
            return `
          <div class="w3-padding-small w3-border-bottom">
            <div>
              <span class="w3-tag w3-round-xxlarge w3-light-gray">
                ${a.code ? `<b>${a.code}</b> - ` : ""}${a.name}
              </span>
              <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span>
            </div>
            <div class="w3-small w3-margin-top">
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
                onclick='openEditAcademy(${JSON.stringify(a)})'>
                Editar
              </button>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="toggleAcademyStatus(${a.id}, ${!a.is_active})">
                ${toggleText}
              </button>
              ${deleteBtn}
            </div>
          </div>
        `;
          })
          .join("");
      }
    }

    // Select de academias para categorías (solo activas)
    if (selCatAcad) {
      selCatAcad.innerHTML =
        `<option value="">Seleccione una academia…</option>` +
        activeAcademies
          .map(
            (a) =>
              `<option value="${a.id}">${a.code ? a.code + " - " : ""}${a.name}</option>`
          )
          .join("");
    }

    // También actualizamos combos de academias en otras zonas
    await loadAcademiesSelect("aAcademy");
    await loadAcademiesSelect("eAcademy");
    await loadAcademiesSelect("caAcademy");

    if (msg) {
      msg.className = "w3-small w3-center w3-text-gray";
      msg.textContent = "";
    }
  } catch (e) {
    console.error(e);
    if (list)
      list.innerHTML = `<div class="w3-text-red w3-small">${e.message}</div>`;
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

async function adminCreateAcademy() {
  const name = (document.getElementById("admAcadName")?.value || "").trim();
  const code = (document.getElementById("admAcadCode")?.value || "").trim();
  const description = (document.getElementById("admAcadDesc")?.value || "").trim();
  const msg = document.getElementById("admAcadMsg");

  if (!msg) return;
  msg.textContent = "";

  if (!name) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "El nombre de la academia es obligatorio.";
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const isEdit = Boolean(editingAcademyId);
    const url = isEdit ? `${API_URL}/academies/${editingAcademyId}` : `${API_URL}/academies/`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({ name, code: code || null, description: description || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo guardar la academia");

    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = isEdit
      ? "✅ Academia actualizada correctamente."
      : "✅ Academia creada correctamente.";

    cancelEditAcademy();
    await adminReloadAcademiesUI();
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function toggleAcademyStatus(academyId, isActive) {
  try {
    const res = await fetch(`${API_URL}/academies/${academyId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el estado");
    await adminReloadAcademiesUI();
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function deleteAcademy(academyId) {
  const ok = await showConfirmModal("\u00bfEliminar esta academia?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/academies/${academyId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo eliminar la academia");
    await adminReloadAcademiesUI();
  } catch (e) {
    showAlertModal(e.message);
  }
}

// --- Categorías ---

async function adminReloadCategoriesUI() {
  const selCatAcad = document.getElementById("admCatAcademy");
  const list = document.getElementById("admCatList");
  const selLvlCat = document.getElementById("admLvlCategory");
  const msg = document.getElementById("admCatMsg");

  if (!list) return;
  list.innerHTML = `<div class="w3-text-gray w3-small">Cargando categorías…</div>`;

  const academyId = selCatAcad ? selCatAcad.value : "";

  if (!academyId) {
    list.innerHTML = `<div class="w3-text-gray w3-small">
      Selecciona una academia para ver sus categorías.
    </div>`;
    if (selLvlCat) {
      selLvlCat.innerHTML = `<option value="">Seleccione una categoría…</option>`;
    }
    return;
  }

  try {
    const resAll = await fetch(
      `${API_URL}/categories/?academy_id=${academyId}&include_inactive=true`,
      { headers: authHeaders() }
    );
    const categories = await resAll.json();
    if (!resAll.ok) throw new Error(categories.detail || "No se pudieron cargar las categorías");

    if (!categories.length) {
      list.innerHTML = `<div class="w3-text-gray w3-small">No hay categorías para esta academia.</div>`;
    } else {
        const pageItems = paginateList(categories, "adminCategories", "admCatList", adminReloadCategoriesUI);

        list.innerHTML = pageItems
          .map((c) => {
            const statusText = c.is_active ? "Activa" : "Inactiva";
            const statusClass = c.is_active ? "w3-text-green" : "w3-text-red";
            const toggleText = c.is_active ? "Inactivar" : "Activar";
            const deleteBtn = !c.is_active
              ? `<button
                  class="w3-button w3-red w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="deleteCategory(${c.id})">
                  Eliminar
                </button>`
              : "";
            return `
          <div class="w3-padding-small w3-border-bottom">
            <div>
              <span class="w3-tag w3-round-xxlarge w3-pale-blue">
                ${c.name}
            </span>
            <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span>
          </div>
          <div class="w3-small w3-text-gray">${c.description || ""}</div>
          <div class="w3-small w3-margin-top">
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
              onclick='openEditCategory(${JSON.stringify(c)})'>
              Editar
            </button>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="toggleCategoryStatus(${c.id}, ${!c.is_active})">
                ${toggleText}
              </button>
              ${deleteBtn}
            </div>
          </div>
        `;
          })
          .join("");
    }

    // También alimentamos el select de categoría para niveles (incluye inactivas)
    if (selLvlCat) {
      selLvlCat.innerHTML =
        `<option value="">Seleccione una categoría…</option>` +
        categories
          .map((c) => {
            const suffix = c.is_active ? "" : " (Inactiva)";
            return `<option value="${c.id}">${c.name}${suffix}</option>`;
          })
          .join("");
    }

    if (msg) {
      msg.className = "w3-small w3-center w3-text-gray";
      msg.textContent = "";
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="w3-text-red w3-small">${e.message}</div>`;
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

async function adminCreateCategory() {
  const academySel = document.getElementById("admCatAcademy");
  const name = (document.getElementById("admCatName")?.value || "").trim();
  const description = (document.getElementById("admCatDesc")?.value || "").trim();
  const msg = document.getElementById("admCatMsg");

  if (!msg || !academySel) return;
  msg.textContent = "";

  const academy_id = academySel.value;
  if (!academy_id) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Debes seleccionar una academia.";
    return;
  }
  if (!name) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "El nombre de la categoría es obligatorio.";
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const isEdit = Boolean(editingCategoryId);
    const url = isEdit ? `${API_URL}/categories/${editingCategoryId}` : `${API_URL}/categories/`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({ academy_id: Number(academy_id), name, description: description || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo guardar la categoría");

    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = isEdit
      ? "✅ Categoría actualizada correctamente."
      : "✅ Categoría creada correctamente.";

    cancelEditCategory();
    await adminReloadCategoriesUI();
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function toggleCategoryStatus(categoryId, isActive) {
  try {
    const res = await fetch(`${API_URL}/categories/${categoryId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el estado");
    await adminReloadCategoriesUI();
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function deleteCategory(categoryId) {
  const ok = await showConfirmModal("\u00bfEliminar esta categor\u00eda?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo eliminar la categoria");
    await adminReloadCategoriesUI();
  } catch (e) {
    showAlertModal(e.message);
  }
}

// --- Niveles ---

async function adminReloadLevelsUI() {
  const selLvlCat = document.getElementById("admLvlCategory");
  const list = document.getElementById("admLvlList");
  const msg = document.getElementById("admLvlMsg");

  if (!list) return;
  list.innerHTML = `<div class="w3-text-gray w3-small">Cargando niveles…</div>`;

  const categoryId = selLvlCat ? selLvlCat.value : "";

  if (!categoryId) {
    list.innerHTML = `<div class="w3-text-gray w3-small">
      Selecciona una categoría para ver sus niveles.
    </div>`;
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/levels/?category_id=${categoryId}&include_inactive=true`,
      { headers: authHeaders() }
    );
    const levels = await res.json();
    if (!res.ok) throw new Error(levels.detail || "No se pudieron cargar los niveles");

    if (!levels.length) {
      list.innerHTML = `<div class="w3-text-gray w3-small">No hay niveles para esta categoría.</div>`;
    } else {
        const pageItems = paginateList(levels, "adminLevels", "admLvlList", adminReloadLevelsUI);

        list.innerHTML = pageItems
          .map((l) => {
            const statusText = l.is_active ? "Activo" : "Inactivo";
            const statusClass = l.is_active ? "w3-text-green" : "w3-text-red";
            const toggleText = l.is_active ? "Inactivar" : "Activar";
            const deleteBtn = !l.is_active
              ? `<button
                  class="w3-button w3-red w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="deleteLevel(${l.id})">
                  Eliminar
                </button>`
              : "";
            return `
          <div class="w3-padding-small w3-border-bottom">
            <div>
              <span class="w3-tag w3-round-xxlarge w3-pale-green">
                ${l.name}
            </span>
            <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span>
          </div>
          <div class="w3-small w3-text-gray">${l.description || ""}</div>
          <div class="w3-small w3-margin-top">
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
              onclick='openEditLevel(${JSON.stringify(l)})'>
              Editar
            </button>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="toggleLevelStatus(${l.id}, ${!l.is_active})">
                ${toggleText}
              </button>
              ${deleteBtn}
            </div>
          </div>
        `;
          })
          .join("");
    }

    if (msg) {
      msg.className = "w3-small w3-center w3-text-gray";
      msg.textContent = "";
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="w3-text-red w3-small">${e.message}</div>`;
    if (msg) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = e.message;
    }
  }
}

async function adminCreateLevel() {
  const selLvlCat = document.getElementById("admLvlCategory");
  const name = (document.getElementById("admLvlName")?.value || "").trim();
  const description = (document.getElementById("admLvlDesc")?.value || "").trim();
  const msg = document.getElementById("admLvlMsg");

  if (!msg || !selLvlCat) return;
  msg.textContent = "";

  const category_id = selLvlCat.value;
  if (!category_id) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Debes seleccionar una categoría.";
    return;
  }
  if (!name) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "El nombre del nivel es obligatorio.";
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const isEdit = Boolean(editingLevelId);
    const url = isEdit ? `${API_URL}/levels/${editingLevelId}` : `${API_URL}/levels/`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({ category_id: Number(category_id), name, description: description || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo guardar el nivel");

    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = isEdit
      ? "✅ Nivel actualizado correctamente."
      : "✅ Nivel creado correctamente.";

    cancelEditLevel();
    await adminReloadLevelsUI();
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function toggleLevelStatus(levelId, isActive) {
  try {
    const res = await fetch(`${API_URL}/levels/${levelId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el estado");
    await adminReloadLevelsUI();
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function deleteLevel(levelId) {
  const ok = await showConfirmModal("\u00bfEliminar este nivel?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/levels/${levelId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo eliminar el nivel");
    await adminReloadLevelsUI();
  } catch (e) {
    showAlertModal(e.message);
  }
}

// --------------------------------------------------
// ADMIN: Asignación de entrenadores
// --------------------------------------------------

async function adminInitCoachAssignments() {
  const coachSel = document.getElementById("caCoach");
  const academySel = document.getElementById("caAcademy");
  const categorySel = document.getElementById("caCategory");
  const levelSel = document.getElementById("caLevel");
  const createBtn = document.getElementById("caCreateBtn");
  const cancelBtn = document.getElementById("caCancelBtn");

  if (!coachSel || !academySel || !categorySel || !levelSel || !createBtn) {
    // El HTML no tiene esta sección (por si acaso)
    return;
  }

  // Eventos
  coachSel.onchange = () => {
    const coachId = coachSel.value;
    const caList = document.getElementById("caList");
    cancelEditCoachAssignment();
    if (coachId) {
      loadCoachAssignments(coachId);
    } else if (caList) {
      caList.innerHTML =
        `<div class="w3-text-gray w3-small">Seleccione un coach para ver sus asignaciones.</div>`;
    }
  };

  academySel.onchange = async () => {
    const academyId = academySel.value;
    await loadCategoriesSelect(academyId, "caCategory");
    // Al cambiar academia, limpiamos niveles
    await loadLevelsSelect("", "caLevel");
  };

  categorySel.onchange = async () => {
    const categoryId = categorySel.value;
    await loadLevelsSelect(categoryId, "caLevel");
  };

  createBtn.onclick = adminCreateCoachAssignment;
  if (cancelBtn) cancelBtn.onclick = cancelEditCoachAssignment;

  // Carga inicial de coaches y academias
  await loadCoachesSelect("caCoach");
  await loadAcademiesSelect("caAcademy");

  // Mensaje inicial
  const caList = document.getElementById("caList");
  if (caList) {
    caList.innerHTML =
      `<div class="w3-text-gray w3-small">Seleccione un coach para ver sus asignaciones.</div>`;
  }
}

function cancelEditCoachAssignment() {
  editingAssignmentId = null;
  changingAssignmentId = null;
  changingAssignmentCoachId = null;
  const btn = document.getElementById("caCreateBtn");
  const cancelBtn = document.getElementById("caCancelBtn");
  if (btn) btn.textContent = "Guardar asignaci\u00f3n";
  if (cancelBtn) cancelBtn.style.display = "none";
}

async function openEditCoachAssignment(a) {
  editingAssignmentId = a.id;
  changingAssignmentId = null;
  changingAssignmentCoachId = null;
  const btn = document.getElementById("caCreateBtn");
  const cancelBtn = document.getElementById("caCancelBtn");
  if (btn) btn.textContent = "Actualizar asignaci\u00f3n";
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  const academySel = document.getElementById("caAcademy");
  const categorySel = document.getElementById("caCategory");
  const levelSel = document.getElementById("caLevel");

  if (academySel) academySel.value = String(a.academy_id || "");
  await loadCategoriesSelect(a.academy_id, "caCategory");
  if (categorySel) categorySel.value = a.category_id ? String(a.category_id) : "";
  await loadLevelsSelect(a.category_id, "caLevel");
  if (levelSel) levelSel.value = a.level_id ? String(a.level_id) : "";
}

async function openChangeCoachAssignment(a) {
  editingAssignmentId = null;
  changingAssignmentId = a.id;
  changingAssignmentCoachId = a.coach_user_id || null;
  const btn = document.getElementById("caCreateBtn");
  const cancelBtn = document.getElementById("caCancelBtn");
  if (btn) btn.textContent = "Cambiar entrenador";
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  const coachSel = document.getElementById("caCoach");
  const academySel = document.getElementById("caAcademy");
  const categorySel = document.getElementById("caCategory");
  const levelSel = document.getElementById("caLevel");

  await loadCoachesSelect("caCoach");
  await loadAcademiesSelect("caAcademy");

  if (coachSel) coachSel.value = a.coach_user_id ? String(a.coach_user_id) : "";
  if (academySel) academySel.value = String(a.academy_id || "");
  await loadCategoriesSelect(a.academy_id, "caCategory");
  if (categorySel) categorySel.value = a.category_id ? String(a.category_id) : "";
  await loadLevelsSelect(a.category_id, "caLevel");
  if (levelSel) levelSel.value = a.level_id ? String(a.level_id) : "";
}

async function adminCreateCoachAssignment() {
  const coachSel = document.getElementById("caCoach");
  const academySel = document.getElementById("caAcademy");
  const categorySel = document.getElementById("caCategory");
  const levelSel = document.getElementById("caLevel");
  const msg = document.getElementById("caMsg");

  if (!coachSel || !academySel || !categorySel || !levelSel || !msg) return;

  msg.textContent = "";

  const coach_user_id = coachSel.value ? Number(coachSel.value) : null;
  const academy_id = academySel.value ? Number(academySel.value) : null;
  const category_id = categorySel.value ? Number(categorySel.value) : null;
  const level_id = levelSel.value ? Number(levelSel.value) : null;

  // En tu modelo de negocio actual: todos obligatorios
  if (!coach_user_id || !academy_id || !category_id || !level_id) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Coach, academia, categorA-a y nivel son obligatorios.";
    return;
  }

  const isEdit = Boolean(editingAssignmentId);
  const isChange = Boolean(changingAssignmentId);

  if (isChange && changingAssignmentCoachId && coach_user_id === changingAssignmentCoachId) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Seleccione un entrenador diferente para el cambio.";
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    if (isEdit) {
      const res = await fetch(`${API_URL}/admin/coach-assignments/${editingAssignmentId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ academy_id: academy_id, category_id: category_id, level_id: level_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo guardar la asignaci\u00f3n");
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Ajuste guardado correctamente.";
      cancelEditCoachAssignment();
      await loadCoachAssignments(coach_user_id);
      return;
    }

    const createRes = await fetch(`${API_URL}/admin/coach-assignments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        coach_user_id: coach_user_id,
        academy_id: academy_id,
        category_id: category_id,
        level_id: level_id,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.detail || "No se pudo guardar la asignaci\u00f3n");

    if (isChange && changingAssignmentId) {
      const closeRes = await fetch(
        `${API_URL}/admin/coach-assignments/${changingAssignmentId}/close`,
        { method: "PATCH", headers: authHeaders() }
      );
      const closeData = await closeRes.json();
      if (!closeRes.ok) {
        throw new Error(closeData.detail || "No se pudo eliminar la asignaci\u00f3n anterior");
      }
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Entrenador cambiado correctamente.";
    } else {
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Asignaci\u00f3n creada correctamente.";
    }

    cancelEditCoachAssignment();
    await loadCoachAssignments(coach_user_id);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function loadCoachAssignments(coachId) {
  const box = document.getElementById("caList");
  if (!box) return;

  box.innerHTML = `<div class="w3-text-gray w3-small">Cargando asignaciones…</div>`;

  try {
    const res = await fetch(
      `${API_URL}/admin/coach-assignments/coach/${coachId}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar las asignaciones");

    // Solo mostrar asignaciones activas (sin end_date)
    const activeAssignments = data.filter(a => !a.end_date);

    if (!activeAssignments.length) {
      box.innerHTML =
        `<div class="w3-text-gray w3-small">Este coach no tiene asignaciones activas.</div>`;
      return;
    }

    const pageItems = paginateList(activeAssignments, "coachAssignments", "caList", () => loadCoachAssignments(coachId));

    box.innerHTML = pageItems
      .map((a) => {
        const active = !a.end_date;
        const startStr = a.start_date || "";
        const endStr = a.end_date || "";
        const rangeText = startStr
          ? `${startStr}${endStr ? " → " + endStr : ""}`
          : "";

        return `
        <div class="w3-card w3-round-xxlarge w3-padding-small w3-margin-bottom">
          <div class="w3-row">
            <div class="w3-col s12 m8">
              <b>${a.academy_name || "Academia sin nombre"}</b><br>
              <span class="w3-small w3-text-gray">
                Categoría: ${a.category_name || "-"} · Nivel: ${a.level_name || "-"}
              </span><br>
              <span class="w3-small ${active ? "w3-text-green" : "w3-text-gray"}">
                ${active ? "Activa" : "Cerrada"} ${rangeText ? " · " + rangeText : ""}
              </span>
            </div>
              <div class="w3-col s12 m4 w3-right-align">
                ${
                  active
                    ? `<button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                        onclick='openEditCoachAssignment(${JSON.stringify(a)})'>
                        Editar
                      </button>
                      <button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                        onclick='openChangeCoachAssignment(${JSON.stringify(a)})'>
                        Cambiar entrenador
                      </button>
                      <button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                        onclick="closeCoachAssignment(${a.id}, ${coachId})">
                        Eliminar
                      </button>`
                    : `<button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                        onclick="reopenCoachAssignment(${a.id}, ${coachId})">
                        Reabrir
                      </button>
                      <button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                        onclick='duplicateCoachAssignment(${JSON.stringify(a)}, ${coachId})'>
                        Duplicar
                      </button>`
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    box.innerHTML = `<div class="w3-text-red w3-small">${e.message}</div>`;
  }
}

async function closeCoachAssignment(assignmentId, coachId) {
  const ok = await showConfirmModal("\u00bfEliminar esta asignaci\u00f3n? Se mantiene el hist\u00f3rico.");
  if (!ok) return;

  try {
    const res = await fetch(`${API_URL}/admin/coach-assignments/${assignmentId}/close`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo eliminar la asignaci\u00f3n");

    cancelEditCoachAssignment();
    await loadCoachAssignments(coachId);
  } catch (e) {
    showAlertModal("❌ " + e.message);
  }
}

async function reopenCoachAssignment(assignmentId, coachId) {
  const ok = await showConfirmModal("\u00bfReabrir esta asignaci\u00f3n?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/admin/coach-assignments/${assignmentId}/reopen`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo reabrir la asignacion");
    await loadCoachAssignments(coachId);
  } catch (e) {
    showAlertModal(e.message);
  }
}

async function duplicateCoachAssignment(assignment, coachId) {
  const ok = await showConfirmModal("\u00bfDuplicar esta asignaci\u00f3n?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/admin/coach-assignments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        coach_user_id: assignment.coach_user_id,
        academy_id: assignment.academy_id,
        category_id: assignment.category_id,
        level_id: assignment.level_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo duplicar la asignacion");
    await loadCoachAssignments(coachId);
  } catch (e) {
    showAlertModal(e.message);
  }
}

// --------------------------------------------------
// Atletas
// --------------------------------------------------

function renderAdminAthletes() {
  const box = document.getElementById("athleteList");
  if (!box) return;

  const filters = getFilterValues("admin");
  const filtered = adminAthletesCache.filter((a) => athleteMatchesFilters(a, filters));

  if (!filtered.length) {
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay atletas registrados.</div>`;
    return;
  }

  const pageItems = paginateList(filtered, "adminAthletes", "athleteList", renderAdminAthletes);

  box.innerHTML = pageItems
    .map((a) => {
      let buttons = "";
      const isActive = a.is_active !== false;
      const statusText = isActive ? "Activo" : "Inactivo";
      const statusClass = isActive ? "w3-text-green" : "w3-text-red";
      const reactivateBtn =
        !isActive && role !== "coach"
          ? `<button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
              onclick='reactivateAthlete(${a.id})'>
              Reactivar
            </button>`
          : "";
      const assignments = (a.assignments || [])
        .map((as) => {
          const coachText = as.coach_name ? ` • Coach: ${as.coach_name}` : "";
          return `
            <span class="w3-tag w3-round-xxlarge w3-light-gray w3-small w3-margin-right w3-margin-bottom">
              ${as.academy_name || "-"} / ${as.category_name || "-"} / ${as.level_name || "-"}${coachText}
            </span>
          `;
        })
        .join("");

      if ((role === "admin" || role === "general") && isActive) {
        buttons = `
        <button
          class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
          onclick='openEditAthlete(${JSON.stringify(a)})'>
          ✏️ Editar
        </button>
        <button
          class="w3-button w3-red w3-round-xxlarge w3-small w3-margin-left"
          onclick='deleteAthlete(${a.id})'>
          🗑️ Eliminar
        </button>
      `;
      }

      const assignBtn =
        (role === "admin" && isActive)
          ? `<button
              class="w3-button w3-blue w3-round-xxlarge w3-small w3-margin-left"
              onclick="openAssignLevel(${a.id})">
              + Asignar nivel
            </button>`
          : "";

      const genderText =
        a.gender === "M" ? "Masculino" : a.gender === "F" ? "Femenino" : "-";
      const showBirth = role === "admin";
      const birthText = showBirth ? formatBirth(a.birth_date) : "";
      const ageText = showBirth ? computeAge(a.birth_date) : null;
      const ageLabel = ageText === null ? "-" : `${ageText}`;

      return `
      <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom w3-row">
        <div class="w3-col s3 m2">
          ${
            a.photo_url
              ? `<img src="${API_URL}${a.photo_url}" class="w3-image w3-round-xxlarge" style="max-height:80px;">`
              : `<div class="w3-gray w3-round-xxlarge" style="height:80px"></div>`
          }
        </div>
        <div class="w3-col s9 m10">
          <b>${a.first_name} ${a.last_name}</b> <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span><br>
          <span class="w3-small w3-text-gray">
          ID: ${a.id_number || "-"} | ${genderText} | ${a.discipline || "Sin disciplina"}
        </span><br>
          ${
            showBirth
              ? `<span class="w3-small w3-text-gray">
            Nacimiento: ${birthText} · Edad: ${ageLabel}
          </span><br>`
              : ""
          }
          <div class="w3-margin-top">${assignments || ""}</div>
          ${buttons}${reactivateBtn}
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
            onclick="openAthleteDetail(${a.id})">
            Ver detalle
          </button>
          ${assignBtn}
        </div>
      </div>
    `;
    })
    .join("");
}

async function loadAthletes() {
  const box = document.getElementById("athleteList");
  box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando atletas…</div>`;
  try {
    const url =
      role === "admin"
        ? API_URL + "/athletes/my?include_inactive=true"
        : API_URL + "/athletes/my";
    const res = await fetch(url, { headers: authHeaders() });
    const athletes = await res.json();
    if (!res.ok) throw new Error(athletes.detail || "No se pudieron cargar los atletas");

    adminAthletesCache = athletes;
    if (role === "general") {
      fillGeneralPlanAthleteSelect();
    }
    buildFilterOptionsFromAthletes(adminAthletesCache, "admin");
    renderAdminAthletes();
    if (!adminFiltersInit) {
      initAthleteFilters("admin", renderAdminAthletes);
      adminFiltersInit = true;
    }

    const filtersBox = document.getElementById("adminAthleteFilters");
    if (filtersBox && role !== "admin") {
      filtersBox.style.display = "none";
    }
  } catch (e) {
    box.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

async function loadCoachAthletePanels() {
  const allList = document.getElementById("coachAllAthletesList");
  const teamsList = document.getElementById("coachTeamsList");
  if (!allList || !teamsList) return;

  allList.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando atletas…</div>`;
  teamsList.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando equipos…</div>`;

  const coachUserId = getUserId();
  if (!coachUserId) {
    allList.innerHTML = `<div class="w3-center w3-text-red w3-small">No se pudo leer el usuario.</div>`;
    teamsList.innerHTML = `<div class="w3-center w3-text-red w3-small">No se pudo leer el usuario.</div>`;
    return;
  }

  try {
    const url =
      role === "admin"
        ? API_URL + "/athletes/my?include_inactive=true"
        : API_URL + "/athletes/my";
    const res = await fetch(url, { headers: authHeaders() });
    const athletes = await res.json();
    if (!res.ok) throw new Error(athletes.detail || "No se pudieron cargar los atletas");

    coachAthletesCache = athletes;
    buildFilterOptionsFromAthletes(coachAthletesCache, "coach");
    renderCoachAllAthletes();
    if (!coachFiltersInit) {
      initAthleteFilters("coach", renderCoachAllAthletes);
      coachFiltersInit = true;
    }

    if (!coachAthletesCache.length) {
      teamsList.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin equipos asignados.</div>`;
      return;
    }

    const teams = {};
    coachAthletesCache.forEach((a) => {
      (a.assignments || []).forEach((as) => {
        if (as.coach_user_id !== coachUserId) return;
        const key = `${as.academy_name || "-"}|${as.category_name || "-"}|${as.level_name || "-"}`;
        if (!teams[key]) {
          teams[key] = {
            academy: as.academy_name || "-",
            category: as.category_name || "-",
            level: as.level_name || "-",
            athletes: [],
          };
        }
        teams[key].athletes.push({
          id: a.id,
          name: `${a.first_name} ${a.last_name}`,
        });
      });
    });

    const teamKeys = Object.keys(teams);
    if (!teamKeys.length) {
      teamsList.innerHTML = `<div class="w3-center w3-text-gray w3-small">No tienes deportistas asignados a tus niveles.</div>`;
      return;
    }

    const pageKeys = paginateList(teamKeys, "coachTeams", "coachTeamsList", loadCoachAthletePanels);

    teamsList.innerHTML = pageKeys
      .map((key) => {
        const team = teams[key];
        const items = team.athletes
          .map(
            (a) => `
          <div class="w3-small w3-padding-small">
            ${a.name}
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
              onclick="openAthleteDetail(${a.id})">
              Ver
            </button>
          </div>
        `
          )
          .join("");
        return `
        <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom">
          <b>${team.academy} / ${team.category} / ${team.level}</b>
          <div class="w3-small w3-text-gray">Integrantes: ${team.athletes.length}</div>
          <div class="w3-margin-top">${items}</div>
        </div>
        `;
      })
      .join("");
  } catch (e) {
    allList.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
    teamsList.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function renderCoachAllAthletes() {
  const allList = document.getElementById("coachAllAthletesList");
  if (!allList) return;

  const filters = getFilterValues("coach");
  const filtered = coachAthletesCache.filter((a) => athleteMatchesFilters(a, filters));

  if (!filtered.length) {
    allList.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay atletas registrados.</div>`;
    return;
  }

  const pageItems = paginateList(filtered, "coachAthletes", "coachAllAthletesList", renderCoachAllAthletes);

  allList.innerHTML = pageItems
    .map((a) => {
      const isActive = a.is_active !== false;
      const statusText = isActive ? "Activo" : "Inactivo";
      const statusClass = isActive ? "w3-text-green" : "w3-text-red";
      const assignments = (a.assignments || [])
        .map((as) => {
          const coachText = as.coach_name ? ` • Coach: ${as.coach_name}` : "";
          return `
            <span class="w3-tag w3-round-xxlarge w3-light-gray w3-small w3-margin-right w3-margin-bottom">
              ${as.academy_name || "-"} / ${as.category_name || "-"} / ${as.level_name || "-"}${coachText}
            </span>
          `;
        })
        .join("");
      const genderText =
        a.gender === "M" ? "Masculino" : a.gender === "F" ? "Femenino" : "-";
      const birthText = formatBirth(a.birth_date);
      const ageText = computeAge(a.birth_date);
      const ageLabel = ageText === null ? "-" : `${ageText}`;
      return `
      <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom w3-row">
        <div class="w3-col s3 m2">
          ${
            a.photo_url
              ? `<img src="${API_URL}${a.photo_url}" class="w3-image w3-round-xxlarge" style="max-height:80px;">`
              : `<div class="w3-gray w3-round-xxlarge" style="height:80px"></div>`
          }
        </div>
        <div class="w3-col s9 m10">
          <b>${a.first_name} ${a.last_name}</b> <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span><br>
          <span class="w3-small w3-text-gray">
            ID: ${a.id_number || "-"} · ${genderText} · ${a.discipline || "Sin disciplina"}
          </span><br>
          <span class="w3-small w3-text-gray">
            Nacimiento: ${birthText} · Edad: ${ageLabel}
          </span><br>
          <div class="w3-margin-top">${assignments || ""}</div>
          <button
            class="w3-button w3-blue w3-round-xxlarge w3-small w3-margin-top"
            onclick="openAssignLevel(${a.id})">
            + Asignar nivel
          </button>
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left w3-margin-top"
            onclick="openAthleteDetail(${a.id})">
            Ver detalle
          </button>
        </div>
      </div>
      `;
    })
    .join("");
}

function closeAthleteDetail() {
  const modal = document.getElementById("modalAthleteDetail");
  if (modal) modal.style.display = "none";
}

async function openAthleteDetail(athleteId) {
  const modal = document.getElementById("modalAthleteDetail");
  const body = document.getElementById("athleteDetailBody");
  if (!modal || !body) return;

  body.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando detalle…</div>`;
  modal.style.display = "block";

  try {
    const res = await fetch(`${API_URL}/athletes/${athleteId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo cargar el atleta");

    const assignments = (data.assignments || [])
      .map((as) => {
        const coachText = as.coach_name ? ` • Coach: ${as.coach_name}` : "";
        const removeBtn =
          role === "admin" || (role === "coach" && as.coach_user_id === getUserId())
            ? `<button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="removeAthleteAssignment(${data.id}, ${as.id})">
                Quitar
              </button>`
            : "";
        return `
          <div class="w3-padding-small w3-border-bottom">
            <span class="w3-small">
              ${as.academy_name || "-"} / ${as.category_name || "-"} / ${as.level_name || "-"}${coachText}
            </span>
            ${removeBtn}
          </div>
        `;
      })
      .join("");

    const heightLabel = data.height_cm ? `${data.height_cm}` : "-";
    const weightLabel = data.weight_kg ? `${data.weight_kg}` : "-";

    body.innerHTML = `
      <div class="w3-margin-bottom">
        <b>${data.first_name} ${data.last_name}</b><br>
        <span class="w3-small w3-text-gray">
          ID: ${data.id_number || "-"} | ${data.gender || "-"} | ${data.discipline || "Sin disciplina"}
        </span><br>
        <span class="w3-small w3-text-gray">
          Altura: ${heightLabel} cm | Peso: ${weightLabel} kg
        </span>
      </div>
      <div>
        <h5 class="w3-text-indigo" style="margin:6px 0">Asignaciones</h5>
        ${assignments || '<div class="w3-small w3-text-gray">Sin asignaciones.</div>'}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
  }
}

function getUserId() {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_id;
  } catch {
    return null;
  }
}

function closeAssignLevel() {
  const modal = document.getElementById("modalAssignLevel");
  if (modal) modal.style.display = "none";
}

async function openAssignLevel(athleteId) {
  const modal = document.getElementById("modalAssignLevel");
  const msg = document.getElementById("assignLevelMsg");
  const coachWrap = document.getElementById("assignCoachWrap");
  const coachSel = document.getElementById("assignCoachUserId");
  const levelSel = document.getElementById("assignLevelId");
  if (!modal || !msg || !levelSel) return;

  document.getElementById("assignAthleteId").value = athleteId;
  msg.textContent = "";
  levelSel.innerHTML = `<option value="">Seleccione un nivel…</option>`;

  if (role === "admin") {
    if (coachWrap) coachWrap.style.display = "block";
    if (coachSel) {
      coachSel.innerHTML = `<option value="">Seleccione un coach…</option>`;
      coachSel.onchange = async () => {
        const coachId = coachSel.value;
        if (coachId) {
          await loadLevelsForCoach(coachId);
        } else {
          levelSel.innerHTML = `<option value="">Seleccione un nivel…</option>`;
        }
      };
      await loadCoachUsersSelectForAssign();
    }
  } else {
    if (coachWrap) coachWrap.style.display = "none";
    await loadLevelsForCurrentCoach();
  }

  modal.style.display = "block";
}

async function loadCoachUsersSelectForAssign() {
  const sel = document.getElementById("assignCoachUserId");
  if (!sel) return;

  try {
    const res = await fetch(`${API_URL}/coaches/`, { headers: authHeaders() });
    const coaches = await res.json();
    if (!res.ok) throw new Error(coaches.detail || "No se pudieron cargar los coaches");
    sel.innerHTML =
      `<option value="">Seleccione un coach…</option>` +
      coaches.map((c) => `<option value="${c.user_id}">${c.full_name}</option>`).join("");
  } catch (e) {
    sel.innerHTML = `<option value="">Error cargando coaches</option>`;
  }
}

async function loadLevelsForCoach(coachUserId) {
  const levelSel = document.getElementById("assignLevelId");
  if (!levelSel) return;

  try {
    const res = await fetch(
      `${API_URL}/admin/coach-assignments/coach/${coachUserId}?active_only=true`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");
    levelSel.innerHTML =
      `<option value="">Seleccione un nivel…</option>` +
      data
        .map(
          (a) =>
            `<option value="${a.level_id}">${a.academy_name} / ${a.category_name} / ${a.level_name}</option>`
        )
        .join("");
  } catch (e) {
    levelSel.innerHTML = `<option value="">Error cargando niveles</option>`;
  }
}

async function loadLevelsForCurrentCoach() {
  const levelSel = document.getElementById("assignLevelId");
  if (!levelSel) return;

  try {
    const res = await fetch(`${API_URL}/admin/coach-assignments/my/active`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");
    levelSel.innerHTML =
      `<option value="">Seleccione un nivel…</option>` +
      data
        .map(
          (a) =>
            `<option value="${a.level_id}">${a.academy_name} / ${a.category_name} / ${a.level_name}</option>`
        )
        .join("");
  } catch (e) {
    levelSel.innerHTML = `<option value="">Error cargando niveles</option>`;
  }
}

async function saveAssignLevel() {
  const athleteId = document.getElementById("assignAthleteId").value;
  const coachSel = document.getElementById("assignCoachUserId");
  const levelSel = document.getElementById("assignLevelId");
  const msg = document.getElementById("assignLevelMsg");
  if (!athleteId || !levelSel || !msg) return;

  msg.textContent = "";
  const levelId = levelSel.value ? Number(levelSel.value) : null;
  if (!levelId) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Debes seleccionar un nivel.";
    return;
  }

  const payload = { level_id: levelId };
  if (role === "admin" && coachSel && coachSel.value) {
    payload.coach_user_id = Number(coachSel.value);
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const res = await fetch(`${API_URL}/athletes/${athleteId}/assignments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo asignar el nivel");
    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = "Asignaci\u00f3n creada correctamente.";
    await loadAthletes();
    if (role == "coach") {
      await loadCoachAthletePanels();
    }
    setTimeout(closeAssignLevel, 700);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function removeAthleteAssignment(athleteId, assignmentId) {
  const ok = await showConfirmModal("\u00bfQuitar esta asignaci\u00f3n?");
  if (!ok) return;
  try {
    const res = await fetch(
      `${API_URL}/athletes/${athleteId}/assignments/${assignmentId}`,
      { method: "DELETE", headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo quitar la asignaci\u00f3n");
    await openAthleteDetail(athleteId);
    await loadAthletes();
  } catch (e) {
    showAlertModal("Error: " + e.message);
  }
}

function openCreateAthlete() {
  const ids = [
    "aFirst",
    "aLast",
    "aBirth",
    "aGender",
    "aHeight",
    "aWeight",
    "aDiscipline",
    "aNotes",
    "aPhoto",
    "aIdNumber",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "SELECT") el.value = "";
    else el.value = "";
  });

  const selAcademy = document.getElementById("aAcademy");
  if (selAcademy) selAcademy.value = "";

  document.getElementById("aMsg").textContent = "";
  document.getElementById("modalCreateAthlete").style.display = "block";
}

function closeCreateAthlete() {
  document.getElementById("modalCreateAthlete").style.display = "none";
}

async function createAthlete() {
  const first_name = document.getElementById("aFirst").value.trim();
  const last_name = document.getElementById("aLast").value.trim();
  const id_number = document.getElementById("aIdNumber").value.trim();
  const academy_id = document.getElementById("aAcademy")
    ? document.getElementById("aAcademy").value
    : "";

  const birth_date = document.getElementById("aBirth").value || "";
  const gender = document.getElementById("aGender").value || "";
  const height_cm = document.getElementById("aHeight").value;
  const weight_kg = document.getElementById("aWeight").value;
  const discipline = document.getElementById("aDiscipline").value || "";
  const notes = document.getElementById("aNotes").value || "";
  const photo = document.getElementById("aPhoto").files[0] || null;

  const msg = document.getElementById("aMsg");
  msg.textContent = "";

  if (!first_name || !last_name || !id_number || !academy_id) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent =
      "Nombre, apellido, identificación y academia son obligatorios.";
    return;
  }

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const fd = new FormData();
    fd.append("id_number", id_number);
    fd.append("full_name", `${first_name} ${last_name}`);
    fd.append("academy_id", academy_id);

    if (birth_date) fd.append("birth_date", birth_date);
    if (gender) fd.append("gender", gender);
    if (height_cm) fd.append("height_cm", height_cm);
    if (weight_kg) fd.append("weight_kg", weight_kg);
    if (discipline) fd.append("discipline", discipline);
    if (notes) fd.append("notes", notes);
    if (photo) fd.append("file", photo);

    const res = await fetch(`${API_URL}/athletes/create`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo crear el atleta");

    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = "✅ Atleta creado correctamente.";
    await loadAthletes();
    setTimeout(closeCreateAthlete, 800);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

// --- Editar atleta ---

function openEditAthlete(a) {
  document.getElementById("editId").value = a.id;
  document.getElementById("eIdNumber").value = a.id_number || "";
  document.getElementById("eFirst").value = a.first_name;
  document.getElementById("eLast").value = a.last_name;
  document.getElementById("eBirth").value = a.birth_date
    ? a.birth_date.split("T")[0]
    : "";
  document.getElementById("eGender").value = a.gender || "";
  document.getElementById("eHeight").value = a.height_cm || "";
  document.getElementById("eWeight").value = a.weight_kg || "";
  document.getElementById("eDiscipline").value = a.discipline || "";
  document.getElementById("eNotes").value = a.notes || "";

  document.getElementById("eaMsg").textContent = "";
  document.getElementById("modalEditAthlete").style.display = "block";
}

function closeEditAthlete() {
  document.getElementById("modalEditAthlete").style.display = "none";
}

async function updateAthlete() {
  const id = document.getElementById("editId").value;
  const msg = document.getElementById("eaMsg");
  const idNumber = document.getElementById("eIdNumber").value.trim();

  const fd = new FormData();
  fd.append("id_number", idNumber);
  fd.append("first_name", document.getElementById("eFirst").value.trim());
  fd.append("last_name", document.getElementById("eLast").value.trim());
  fd.append("birth_date", document.getElementById("eBirth").value);
  fd.append("gender", document.getElementById("eGender").value);
  fd.append("height_cm", document.getElementById("eHeight").value);
  fd.append("weight_kg", document.getElementById("eWeight").value);
  fd.append("discipline", document.getElementById("eDiscipline").value);
  fd.append("notes", document.getElementById("eNotes").value);

  const file = document.getElementById("ePhoto").files[0];
  if (file) fd.append("file", file);

  try {
    setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    const res = await fetch(`${API_URL}/athletes/update/${id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al actualizar atleta");
    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = "✅ Atleta actualizado correctamente.";
    await loadAthletes();
    setTimeout(closeEditAthlete, 800);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
  }
}

async function deleteAthlete(id) {
  const ok = await showConfirmModal("\u00bfEliminar este atleta?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/athletes/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo eliminar el atleta");
    showAlertModal("✅ " + data.message);
    await loadAthletes();
  } catch (e) {
    showAlertModal("❌ " + e.message);
  }
}

async function reactivateAthlete(id) {
  const ok = await showConfirmModal("\u00bfReactivar este atleta?");
  if (!ok) return;
  try {
    const res = await fetch(`${API_URL}/athletes/${id}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_active: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo reactivar el atleta");
    await loadAthletes();
  } catch (e) {
    showAlertModal("�?O " + e.message);
  }
}

// Ensure inline handlers can find billing functions even if script is treated as a module.
window.createBillingPlan = createBillingPlan;
window.createBillingInvoice = createBillingInvoice;
window.selectAthletePlan = selectAthletePlan;
window.openEditInvoice = openEditInvoice;
window.cancelInvoice = cancelInvoice;


window.markInvoicePaid = markInvoicePaid;
window.loadBillingReport = loadBillingReport;
window.generateMonthlyInvoices = generateMonthlyInvoices;
window.fixInvoicePeriods = fixInvoicePeriods;
window.exportBillingCsv = exportBillingCsv;
window.exportBillingPdf = exportBillingPdf;
window.exportAthletesCsv = exportAthletesCsv;
window.exportAthletesPdf = exportAthletesPdf;


window.createAnnouncement = createAnnouncement;
window.openEditAnnouncement = openEditAnnouncement;
window.retireAnnouncement = retireAnnouncement;
window.deleteAnnouncementAttachment = deleteAnnouncementAttachment;
window.cancelSession = cancelSession;
window.cancelSeries = cancelSeries;
window.resetUserPassword = resetUserPassword;
window.reactivateAthlete = reactivateAthlete;
















