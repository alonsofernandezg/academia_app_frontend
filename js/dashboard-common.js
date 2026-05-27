(function () {
  const DEFAULT_API_BASE = "http://127.0.0.1:8000";
  const listPagerState = {};
  let calendarTooltipEl = null;

  function getApiBase() {
    const rawBase = String(window.API_BASE || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  function getSessionToken() {
    return localStorage.getItem("token") || "";
  }

  function authHeaders() {
    const token = getSessionToken();
    return {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    };
  }

  function getCurrentRole() {
    return localStorage.getItem("role") || "general";
  }

  function getUserId() {
    const token = getSessionToken();
    if (!token) return null;

    try {
      const payloadPart = token.split(".")[1];
      if (!payloadPart) return null;
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(normalized));
      return payload.user_id || null;
    } catch {
      return null;
    }
  }

  function resolveFileUrl(pathOrUrl) {
    if (!pathOrUrl) return "";
    const value = String(pathOrUrl).trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return `${getApiBase()}${value}`;
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

  function parseDateValue(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
      return Number.isNaN(dateInput.getTime()) ? null : new Date(dateInput.getTime());
    }

    const rawValue = String(dateInput).trim();
    if (!rawValue) return null;

    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day), 12);
    }

    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function computeAge(dateStr) {
    if (!dateStr) return null;
    const birth = parseDateValue(dateStr);
    if (!birth) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDelta = today.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  }

  function formatBirth(dateStr) {
    if (!dateStr) return "-";
    const dateValue = parseDateValue(dateStr);
    if (!dateValue) return "-";
    return dateValue.toLocaleDateString("es-ES");
  }

  function formatMoney(amount, currency) {
    const value = Number(amount);
    if (Number.isNaN(value)) return "-";
    const selectedCurrency = currency || "CRC";
    return `${value.toFixed(2)} ${selectedCurrency}`;
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
    if (target.scope === "athlete") {
      return `Atleta: ${target.athlete_name || "-"}`;
    }
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
      const levelName = target.level_name || "-";
      const coachName = target.coach_name || "-";
      return `Equipo: ${levelName} / ${coachName}`;
    }
    return target.scope || "-";
  }

  function setStatusMessage(msgEl, text, className) {
    if (!msgEl) return;
    const baseClass = className || "w3-small w3-text-gray w3-center";
    const withMargin = baseClass.includes("w3-margin-top")
      ? baseClass
      : `${baseClass} w3-margin-top`;
    msgEl.className = `ux-inline-feedback ${withMargin}`;
    msgEl.textContent = text;
    msgEl.style.display = "block";
  }

  function renderStateBlock(type, title, body) {
    const icons = {
      loading: "…",
      empty: "○",
      success: "✓",
      error: "!",
    };
    const safeType = icons[type] ? type : "empty";
    const safeTitle = title || "Estado";
    const safeBody = body ? `<div class="ux-state-body">${body}</div>` : "";
    return `
      <div class="ux-state ux-state--${safeType}">
        <div class="ux-state-badge">${icons[safeType]}</div>
        <div class="ux-state-copy">
          <div class="ux-state-title">${safeTitle}</div>
          ${safeBody}
        </div>
      </div>
    `;
  }

  function countActiveFilters(values) {
    return Object.values(values || {}).filter((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && String(value).trim() !== "";
    }).length;
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

  function athleteMatchesFilters(athlete, filters) {
    const name = `${athlete.first_name || ""} ${athlete.last_name || ""}`.toLowerCase();
    const idNumber = (athlete.id_number || "").toLowerCase();
    if (filters.search && !name.includes(filters.search) && !idNumber.includes(filters.search)) {
      return false;
    }

    if (filters.birthFrom || filters.birthTo) {
      if (!athlete.birth_date) return false;
      const birth = parseDateValue(athlete.birth_date);
      if (!birth) return false;
      if (filters.birthFrom) {
        const from = parseDateValue(filters.birthFrom);
        if (!from) return false;
        if (birth < from) return false;
      }
      if (filters.birthTo) {
        const to = parseDateValue(filters.birthTo);
        if (!to) return false;
        if (birth > to) return false;
      }
    }

    const assignmentFilters = [
      ["academy_id", filters.academyId],
      ["category_id", filters.categoryId],
      ["level_id", filters.levelId],
      ["coach_user_id", filters.coachId],
    ].filter(([, value]) => value);

    if (!assignmentFilters.length) {
      return true;
    }

    const assignments = athlete.assignments || [];
    return assignments.some((assignment) =>
      assignmentFilters.every(([key, value]) => String(assignment[key] || "") === String(value))
    );
  }

  function setSelectOptions(selectId, items) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    const options = items
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join("");
    select.innerHTML = `<option value="">Todos</option>` + options;
    if (current) {
      select.value = current;
      if (select.value !== current) select.value = "";
    }
  }

  function buildFilterOptionsFromAthletes(athletes, prefix) {
    const academyMap = new Map();
    const categoryMap = new Map();
    const levelMap = new Map();
    const coachMap = new Map();

    athletes.forEach((athlete) => {
      (athlete.assignments || []).forEach((assignment) => {
        if (assignment.academy_id && assignment.academy_name) {
          academyMap.set(assignment.academy_id, assignment.academy_name);
        }
        if (assignment.category_id && assignment.category_name) {
          categoryMap.set(assignment.category_id, assignment.category_name);
        }
        if (assignment.level_id && assignment.level_name) {
          levelMap.set(assignment.level_id, assignment.level_name);
        }
        if (assignment.coach_user_id && assignment.coach_name) {
          coachMap.set(assignment.coach_user_id, assignment.coach_name);
        }
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

  function renderReportTable(rows, scope) {
    const header = `
      <div class="table-scroll report-table-scroll">
      <table class="w3-table-all w3-small w3-round-xxlarge">
        <thead>
          <tr class="w3-light-gray">
            <th>Academia</th>
            <th>Categoría</th>
            <th>Nivel</th>
            <th>Entrenador</th>
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
        (row) => `
        <tr>
          <td>${row.academy_name || "-"}</td>
          <td>${row.category_name || "-"}</td>
          <td>${row.level_name || "-"}</td>
          <td>${row.coach_name || "-"}</td>
          <td>${row.athlete_name || "-"}</td>
          <td>${row.present_count}</td>
          <td>${row.absent_count}</td>
          <td>${row.justified_count}</td>
        </tr>
      `
      )
      .join("");
    return header + body + "</tbody></table></div>";
  }

  function renderReportTableRows(rows) {
    return rows
      .map(
        (row) => `
        <tr>
          <td>${row.academy_name || "-"}</td>
          <td>${row.category_name || "-"}</td>
          <td>${row.level_name || "-"}</td>
          <td>${row.coach_name || "-"}</td>
          <td>${row.athlete_name || "-"}</td>
          <td>${row.present_count}</td>
          <td>${row.absent_count}</td>
          <td>${row.justified_count}</td>
        </tr>
      `
      )
      .join("");
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
    return data.filter((row) => {
      const haystack = [
        row.academy_name,
        row.category_name,
        row.level_name,
        row.coach_name,
        row.athlete_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (filters.search && !haystack.includes(filters.search)) return false;
      if (filters.level && row.level_name !== filters.level) return false;
      if (filters.athlete && row.athlete_name !== filters.athlete) return false;
      return true;
    });
  }

  function initReportFilters(scope, rows, onUpdate) {
    const setOptions = (id, values) => {
      const select = document.getElementById(id);
      if (!select) return;
      const current = select.value;
      select.innerHTML =
        `<option value="">Todos</option>` +
        values
          .filter(Boolean)
          .sort()
          .map((value) => `<option value="${value}">${value}</option>`)
          .join("");
      if (current) select.value = current;
    };

    setOptions(`${scope}ReportLevel`, rows.map((row) => row.level_name));
    setOptions(`${scope}ReportAthlete`, rows.map((row) => row.athlete_name));

    const attach = (id) => {
      const element = document.getElementById(id);
      if (!element) return;
      const eventName = element.tagName === "INPUT" ? "input" : "change";
      element.addEventListener(eventName, () => {
        if (typeof onUpdate === "function") onUpdate();
      });
    };

    attach(`${scope}ReportSearch`);
    attach(`${scope}ReportLevel`);
    attach(`${scope}ReportAthlete`);
  }

  function renderReportWithFilters(scope, rows, onUpdate) {
    const filterId = (suffix) => `${scope}Report${suffix}`;
    const filtersHtml = `
      <div class="w3-padding-small w3-border w3-round-xxlarge w3-margin-bottom">
        <div class="w3-row-padding" style="margin:0 -8px">
          <div class="w3-col s12 m4">
            <label class="w3-small w3-text-gray">Buscar</label>
            <input id="${filterId("Search")}" class="w3-input w3-border w3-round-large" placeholder="Academia, nivel, entrenador o deportista">
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
    setTimeout(() => initReportFilters(scope, rows, onUpdate), 0);
    return filtersHtml + table;
  }

  function formatCalendarTimeRange(start, end) {
    if (!start) return "";
    const formatTime = (date) =>
      date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
    const startText = formatTime(start);
    const endText = end ? formatTime(end) : "";
    return endText ? `${startText} - ${endText}` : startText;
  }

  function formatLevelLabels(levelIds, labelMap) {
    if (!levelIds || !levelIds.length || !labelMap) return "";
    const labels = levelIds.map((id) => labelMap[id]).filter(Boolean);
    if (!labels.length) return "";
    return labels.join(" | ");
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

  function ensureCalendarTooltip() {
    if (calendarTooltipEl) return calendarTooltipEl;
    const element = document.createElement("div");
    element.className = "calendar-tooltip";
    document.body.appendChild(element);
    calendarTooltipEl = element;
    return element;
  }

  function attachCalendarTooltip(targetEl, text) {
    if (!targetEl || !text) return;
    const tooltip = ensureCalendarTooltip();

    const show = (event) => {
      tooltip.textContent = text;
      tooltip.style.display = "block";
      positionTooltip(event);
    };

    const hideTooltip = () => {
      tooltip.style.display = "none";
    };

    const move = (event) => {
      positionTooltip(event);
    };

    const positionTooltip = (event) => {
      const pad = 12;
      tooltip.style.left = `${event.clientX + pad}px`;
      tooltip.style.top = `${event.clientY + pad}px`;
    };

    targetEl.addEventListener("mouseenter", show);
    targetEl.addEventListener("mousemove", move);
    targetEl.addEventListener("mouseleave", hideTooltip);
  }

  function formatSessionTime(value) {
    if (!value) return "";
    const parts = String(value).split("T");
    if (parts.length < 2) return "";
    const timePart = parts[1].split(".")[0];
    return timePart.slice(0, 5);
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
        resolve(window.confirm(message));
        return;
      }

      msg.textContent = message;

      const cleanup = () => {
        modal.style.display = "none";
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        window.removeEventListener("keydown", onKey);
      };

      const onKey = (event) => {
        if (event.key === "Escape") {
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
      window.alert(message);
      return;
    }

    if (!titleEl.dataset.defaultTitle) {
      titleEl.dataset.defaultTitle = titleEl.textContent || "Aviso";
    }

    msg.textContent = message;
    titleEl.textContent = title || titleEl.dataset.defaultTitle;

    okBtn.onclick = () => {
      modal.style.display = "none";
      okBtn.onclick = null;
    };

    modal.style.display = "block";
  }

  function show(el) {
    if (!el) return;
    el.classList.remove("w3-hide");
  }

  function hide(el) {
    if (!el) return;
    el.classList.add("w3-hide");
  }

  window.DashboardCommon = {
    getApiBase,
    authHeaders,
    getCurrentRole,
    getUserId,
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
    renderStateBlock,
    countActiveFilters,
    getFilterValues,
    athleteMatchesFilters,
    setSelectOptions,
    buildFilterOptionsFromAthletes,
    initAthleteFilters,
    renderReportWithFilters,
    renderReportTable,
    renderReportTableRows,
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
  };
})();