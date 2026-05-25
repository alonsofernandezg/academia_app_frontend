(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para operations.");
  }

  const {
    authHeaders,
    setStatusMessage,
    showConfirmModal,
    formatCalendarTimeRange,
    formatLevelLabels,
    attachCalendarTooltip,
    formatSessionTime,
  } = dashboardCommon;

  let adminCalendarMonth = new Date();
  let coachCalendarMonth = new Date();
  let adminCalendar = null;
  let coachCalendar = null;
  let levelLabelMap = null;
  let levelColorMap = null;
  let categoryColorMap = {};
  let levelToCategoryMap = {};
  let sessionCache = {};
  let editingSessionId = null;

  function getApiUrl() {
    const rawBase = String(window.API_BASE || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  async function loadAdminTrainingSessions() {
    const calendar = document.getElementById("adminSessionCalendar");
    if (!calendar) return;

    calendar.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando sesiones...</div>`;
    try {
      ensureAdminCalendar();
      const activeMonth = adminCalendar ? adminCalendar.getDate() : adminCalendarMonth || new Date();
      adminCalendarMonth = activeMonth;
      const { startDate, endDate } = getMonthRange(activeMonth);
      const res = await fetch(
        `${getApiUrl()}/training-sessions/?start_date=${startDate}&end_date=${endDate}`,
        { headers: authHeaders() }
      );
      const sessions = await res.json();
      if (!res.ok) throw new Error(sessions.detail || "No se pudieron cargar las sesiones");

      cacheSessions(sessions);
      const labelMap = await getLevelLabelMap();
      if (adminCalendar) {
        setCalendarEvents(adminCalendar, sessions, labelMap);
      } else {
        updateCalendarLabel("adminCalendarLabel", activeMonth);
        renderCalendar("adminSessionCalendar", sessions, activeMonth);
      }
    } catch (error) {
      calendar.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  async function loadCoachTrainingSessions() {
    const calendar = document.getElementById("coachSessionCalendar");
    if (!calendar) return;

    calendar.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando sesiones...</div>`;
    try {
      ensureCoachCalendar();
      const activeMonth = coachCalendar ? coachCalendar.getDate() : coachCalendarMonth || new Date();
      coachCalendarMonth = activeMonth;
      const { startDate, endDate } = getMonthRange(activeMonth);
      const res = await fetch(
        `${getApiUrl()}/training-sessions/my?start_date=${startDate}&end_date=${endDate}`,
        { headers: authHeaders() }
      );
      const sessions = await res.json();
      if (!res.ok) throw new Error(sessions.detail || "No se pudieron cargar las sesiones");

      cacheSessions(sessions);
      const labelMap = await getLevelLabelMap();
      if (coachCalendar) {
        setCalendarEvents(coachCalendar, sessions, labelMap);
      } else {
        updateCalendarLabel("coachCalendarLabel", activeMonth);
        renderCalendar("coachSessionCalendar", sessions, activeMonth);
      }
    } catch (error) {
      calendar.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  async function getLevelLabelMap() {
    if (levelLabelMap && levelColorMap && categoryColorMap && Object.keys(levelColorMap).length > 0) {
      return levelLabelMap;
    }

    const map = {};
    const colorMap = {};
    const catColorMap = {};
    const lvlToCatMap = {};
    let categoryIndex = 0;

    const CATEGORY_PALETTE = [
      "hsl(210, 70%, 50%)",
      "hsl(130, 55%, 42%)",
      "hsl(350, 70%, 50%)",
      "hsl(45, 85%, 48%)",
      "hsl(280, 60%, 50%)",
      "hsl(180, 55%, 42%)",
      "hsl(15, 75%, 50%)",
      "hsl(320, 60%, 50%)",
      "hsl(90, 50%, 42%)",
      "hsl(240, 55%, 55%)",
      "hsl(60, 70%, 42%)",
      "hsl(0, 0%, 50%)",
    ];

    function getCategoryColor(index) {
      if (index < CATEGORY_PALETTE.length) return CATEGORY_PALETTE[index];
      const hue = (index * 137) % 360;
      return `hsl(${hue}, 65%, 48%)`;
    }

    try {
      const res = await fetch(`${getApiUrl()}/academies/`, { headers: authHeaders() });
      const academies = await res.json();
      if (!res.ok) throw new Error(academies.detail || "No se pudieron cargar academias");

      for (const academy of academies) {
        const catRes = await fetch(`${getApiUrl()}/categories/?academy_id=${academy.id}`, {
          headers: authHeaders(),
        });
        const categories = await catRes.json();
        if (!catRes.ok) continue;

        for (const category of categories) {
          if (!catColorMap[category.id]) {
            const color = getCategoryColor(categoryIndex++);
            catColorMap[category.id] = { color, name: category.name };
          }
          const catColor = catColorMap[category.id].color;

          const lvlRes = await fetch(`${getApiUrl()}/levels/?category_id=${category.id}`, {
            headers: authHeaders(),
          });
          const levels = await lvlRes.json();
          if (!lvlRes.ok) continue;

          levels.forEach((level) => {
            map[level.id] = `${academy.name} / ${category.name} / ${level.name}`;
            colorMap[level.id] = catColor;
            lvlToCatMap[level.id] = category.id;
          });
        }
      }
    } catch (error) {
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

  function getMonthRange(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const toDate = (value) => {
      const mm = String(value.getMonth() + 1).padStart(2, "0");
      const dd = String(value.getDate()).padStart(2, "0");
      return `${value.getFullYear()}-${mm}-${dd}`;
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

    adminCalendar = new window.FullCalendar.Calendar(el, {
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
        if (btn) {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const sessionId = info.event.extendedProps.sessionId;
            if (sessionId) openAttendance(sessionId);
          });
          attachCalendarTooltip(btn, tooltip);
        }
        const editBtn = info.el.querySelector(".fc-edit-btn");
        if (editBtn) {
          editBtn.addEventListener("click", (event) => {
            event.stopPropagation();
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

    coachCalendar = new window.FullCalendar.Calendar(el, {
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
        if (btn) {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const sessionId = info.event.extendedProps.sessionId;
            if (sessionId) openAttendance(sessionId);
          });
          attachCalendarTooltip(btn, tooltip);
        }
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

    const defaultColor = "hsl(0, 0%, 65%)";
    const usedCategoryIds = new Set();

    const events = sessions.map((session) => {
      let bgColor = defaultColor;
      if (session.level_ids && session.level_ids.length > 0 && levelColorMap) {
        bgColor = levelColorMap[session.level_ids[0]] || defaultColor;
        const catId = levelToCategoryMap[session.level_ids[0]];
        if (catId) usedCategoryIds.add(catId);
      }
      return {
        id: String(session.id),
        start: session.start_datetime,
        end: session.end_datetime,
        backgroundColor: bgColor,
        borderColor: bgColor,
        extendedProps: {
          sessionId: session.id,
          seriesId: session.series_id || null,
          levelLabels: formatLevelLabels(session.level_ids, labelMap),
        },
      };
    });
    calendarInstance.removeAllEvents();
    calendarInstance.addEventSource(events);
    renderCategoryLegend(calendarInstance.el, usedCategoryIds);
  }

  function renderCategoryLegend(calendarEl, usedCategoryIds) {
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

    const items = [...usedCategoryIds]
      .map((catId) => {
        const category = categoryColorMap[catId];
        if (!category) return "";
        return `
          <span style="display:inline-flex;align-items:center;margin-right:14px;margin-bottom:4px">
            <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${category.color};margin-right:5px;flex-shrink:0"></span>
            <span class="w3-small">${category.name}</span>
          </span>`;
      })
      .join("");

    legend.innerHTML = `<div style="display:flex;flex-wrap:wrap;padding:6px 0">${items}</div>`;
  }

  function cacheSessions(sessions) {
    if (!sessions || !sessions.length) return;
    sessions.forEach((session) => {
      sessionCache[session.id] = session;
    });
  }

  function renderCalendar(containerId, sessions, monthDate) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const getMondayIndex = (inputYear, inputMonth) => {
      const dayOfWeek = new Date(Date.UTC(inputYear, inputMonth, 1)).getUTCDay();
      return (dayOfWeek + 6) % 7;
    };
    const startWeekDay = getMondayIndex(year, month);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const sessionsByDay = {};
    sessions.forEach((session) => {
      const date = new Date(session.start_datetime);
      const key = date.getDate();
      if (!sessionsByDay[key]) sessionsByDay[key] = [];
      sessionsByDay[key].push(session);
    });

    const dayLabels = ["L", "M", "X", "J", "V", "S", "D"];
    let html =
      `<div class="w3-row w3-small w3-text-gray">` +
      dayLabels.map((day) => `<div class="w3-col s1 m1" style="width:14.28%">${day}</div>`).join("") +
      `</div>`;

    html += `<div class="w3-row">`;
    for (let index = 0; index < startWeekDay; index += 1) {
      html += `<div class="w3-col s1 m1" style="width:14.28%"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const daySessions = sessionsByDay[day] || [];
      html += `
        <div class="w3-col s1 m1" style="width:14.28%">
          <div class="w3-border w3-round-large w3-padding-small" style="min-height:96px">
            <div class="w3-small w3-text-gray">${day}</div>
            ${daySessions
              .map((session) => {
                const start = formatSessionTime(session.start_datetime);
                const end = formatSessionTime(session.end_datetime);
                return `
                  <div class="w3-small w3-margin-top">
                    ${start}${end ? " - " + end : ""}
                    <button
                      class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                      onclick="window.DashboardOperations.openAttendance(${session.id})">
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

    if (cancelSeriesBtn) {
      const session = editingSessionId ? sessionCache[editingSessionId] : null;
      cancelSeriesBtn.style.display = isEdit && session && session.series_id ? "inline-block" : "none";
    }
  }

  function setSelectedLevels(levelIds) {
    const ids = new Set((levelIds || []).map((id) => Number(id)));
    document.querySelectorAll(".tsLevelOption").forEach((element) => {
      element.checked = ids.has(Number(element.value));
    });
    handleLevelCategoryLock();
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (input) => String(input).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }

  function closeCreateSession() {
    const modal = document.getElementById("modalCreateSession");
    if (modal) modal.style.display = "none";
  }

  function handleFrequencyChange() {
    const frequency = document.getElementById("tsFrequency").value;
    const wrap = document.getElementById("tsWeekdaysWrap");
    if (!wrap) return;
    if (frequency === "weekly") wrap.classList.remove("w3-hide");
    else wrap.classList.add("w3-hide");
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
      const resAcad = await fetch(`${getApiUrl()}/academies/`, { headers: authHeaders() });
      const academies = await resAcad.json();
      if (!resAcad.ok) throw new Error(academies.detail || "Error cargando academias");

      const groups = [];
      for (const academy of academies) {
        const resCat = await fetch(`${getApiUrl()}/categories/?academy_id=${academy.id}`, {
          headers: authHeaders(),
        });
        const categories = await resCat.json();
        if (!resCat.ok) throw new Error(categories.detail || "Error cargando categorías");
        for (const category of categories) {
          const resLvl = await fetch(`${getApiUrl()}/levels/?category_id=${category.id}`, {
            headers: authHeaders(),
          });
          const levels = await resLvl.json();
          if (!resLvl.ok) throw new Error(levels.detail || "Error cargando niveles");
          if (levels.length) {
            groups.push({
              catId: category.id,
              catName: category.name,
              acadName: academy.name,
              levels,
            });
          }
        }
      }

      let html = "";
      for (const group of groups) {
        html += `<div class="w3-margin-bottom" data-cat-group="${group.catId}">`;
        html += `<div class="w3-small w3-text-gray" style="font-weight:600;margin-bottom:2px">${group.acadName} / ${group.catName}</div>`;
        for (const level of group.levels) {
          html += `
            <label class="w3-small" style="display:block;margin-bottom:3px;padding-left:12px">
              <input type="checkbox" class="tsLevelOption" value="${level.id}" data-category-id="${group.catId}"
                     onchange="window.DashboardOperations.handleLevelCategoryLock()"> ${level.name}
            </label>`;
        }
        html += `</div>`;
      }
      list.innerHTML = html;
    } catch (error) {
      list.innerHTML = `<div class="w3-small w3-text-red">${error.message}</div>`;
    }
  }

  function handleLevelCategoryLock() {
    const allBoxes = document.querySelectorAll(".tsLevelOption");
    const checked = [...allBoxes].filter((element) => element.checked);

    if (checked.length === 0) {
      allBoxes.forEach((element) => {
        element.disabled = false;
        element.closest("label").style.opacity = "1";
      });
      document.querySelectorAll("[data-cat-group]").forEach((group) => {
        group.style.opacity = "1";
      });
      return;
    }

    const activeCatId = checked[0].dataset.categoryId;

    allBoxes.forEach((element) => {
      if (element.dataset.categoryId === activeCatId) {
        element.disabled = false;
        element.closest("label").style.opacity = "1";
      } else {
        element.disabled = true;
        element.checked = false;
        element.closest("label").style.opacity = "0.4";
      }
    });

    document.querySelectorAll("[data-cat-group]").forEach((group) => {
      group.style.opacity = group.dataset.catGroup === activeCatId ? "1" : "0.5";
    });
  }

  async function saveCreateSession() {
    const msg = document.getElementById("tsMsg");
    if (!msg) return;
    msg.textContent = "";

    const start = document.getElementById("tsStart").value;
    const end = document.getElementById("tsEnd").value;
    const notes = document.getElementById("tsNotes").value.trim();
    const allLevels = false;
    const frequency = document.getElementById("tsFrequency").value;
    const until = document.getElementById("tsUntil").value;

    if (!start || !end) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Debes indicar inicio y fin.";
      return;
    }

    const levelIds = Array.from(document.querySelectorAll(".tsLevelOption"))
      .filter((element) => element.checked)
      .map((element) => Number(element.value));

    if (!allLevels && !levelIds.length) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Debes seleccionar al menos un nivel.";
      return;
    }

    const weekdays = Array.from(document.querySelectorAll(".tsWeekday"))
      .filter((element) => element.checked)
      .map((element) => Number(element.value));

    const payload = {
      start_datetime: start,
      end_datetime: end,
      notes: notes || null,
      all_levels: allLevels,
      level_ids: allLevels ? null : levelIds,
      frequency: editingSessionId ? "none" : frequency,
      weekdays: editingSessionId ? null : frequency === "weekly" ? weekdays : null,
      until_date: editingSessionId ? null : frequency === "none" ? null : until || null,
    };

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const url = editingSessionId
        ? `${getApiUrl()}/training-sessions/${editingSessionId}`
        : `${getApiUrl()}/training-sessions/`;
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
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  async function cancelSession() {
    if (!editingSessionId) return;
    const ok = await showConfirmModal("¿Cancelar esta sesión?");
    if (!ok) return;
    const msg = document.getElementById("tsMsg");
    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/training-sessions/${editingSessionId}/cancel`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo cancelar la sesion");
      await loadAdminTrainingSessions();
      closeCreateSession();
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  async function cancelSeries() {
    if (!editingSessionId) return;
    const session = sessionCache[editingSessionId];
    if (!session || !session.series_id) return;

    const ok = await showConfirmModal(
      "¿Cancelar TODA la serie de sesiones?\n\nLas sesiones con asistencia registrada se protegerán por defecto."
    );
    if (!ok) return;

    const msg = document.getElementById("tsMsg");
    try {
      setStatusMessage(msg, "Cancelando serie...", "w3-small w3-text-gray w3-center");
      const res = await fetch(
        `${getApiUrl()}/training-sessions/series/${session.series_id}/cancel?cancel_with_attendance=false`,
        { method: "PATCH", headers: authHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo cancelar la serie");

      let summary = `Serie cancelada: ${data.cancelled} cancelada(s)`;
      if (data.skipped > 0) {
        summary += `, ${data.skipped} protegida(s) (con asistencia)`;
      }
      if (data.already_cancelled > 0) {
        summary += `, ${data.already_cancelled} ya cancelada(s)`;
      }

      setStatusMessage(msg, summary, "w3-small w3-text-green w3-center");
      await loadAdminTrainingSessions();
      setTimeout(closeCreateSession, 2500);
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  async function openAttendance(sessionId) {
    const modal = document.getElementById("modalAttendance");
    const rosterBox = document.getElementById("attendanceRoster");
    const msg = document.getElementById("attendanceMsg");
    if (msg) {
      msg.textContent = "";
      msg.className = "w3-small w3-center";
    }
    if (!modal || !rosterBox) return;

    document.getElementById("attendanceSessionId").value = sessionId;
    rosterBox.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando lista...</div>`;
    modal.style.display = "block";

    try {
      const res = await fetch(`${getApiUrl()}/training-sessions/${sessionId}/roster`, {
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
            onclick="window.DashboardOperations.setAllAttendance('Presente')">
            Presente
          </button>
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
            onclick="window.DashboardOperations.setAllAttendance('Ausente')">
            Ausente
          </button>
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
            onclick="window.DashboardOperations.setAllAttendance('Justificado')">
            Justificado
          </button>
        </div>
      `;

      rosterBox.innerHTML =
        bulkControls +
        roster
          .map(
            (entry) => `
        <div class="w3-row w3-padding-small w3-border-bottom">
          <div class="w3-col s12 m6">
            <b>${entry.full_name}</b><br>
            <span class="w3-small w3-text-gray">${entry.id_number || "-"}</span>
          </div>
          <div class="w3-col s12 m6">
            <div class="w3-small w3-margin-top">
              <label class="w3-margin-right">
                <input type="radio" name="att_${entry.athlete_id}" value="Presente" ${entry.status === "Presente" ? "checked" : ""}>
                Presente
              </label>
              <label class="w3-margin-right">
                <input type="radio" name="att_${entry.athlete_id}" value="Ausente" ${entry.status === "Ausente" ? "checked" : ""}>
                Ausente
              </label>
              <label>
                <input type="radio" name="att_${entry.athlete_id}" value="Justificado" ${entry.status === "Justificado" ? "checked" : ""}>
                Justificado
              </label>
            </div>
          </div>
        </div>
        `
          )
          .join("");
    } catch (error) {
      rosterBox.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  function closeAttendance() {
    const modal = document.getElementById("modalAttendance");
    const msg = document.getElementById("attendanceMsg");
    if (msg) {
      msg.textContent = "";
      msg.className = "w3-small w3-center";
    }
    if (modal) modal.style.display = "none";
  }

  async function saveAttendance() {
    const sessionId = document.getElementById("attendanceSessionId").value;
    const msg = document.getElementById("attendanceMsg");
    if (!sessionId || !msg) return;
    msg.textContent = "";

    const items = Array.from(document.querySelectorAll("#attendanceRoster input[type='radio']:checked")).map(
      (element) => ({
        athlete_id: Number(element.name.replace("att_", "")),
        status: element.value,
      })
    );

    if (!items.length) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Selecciona al menos un estado.";
      return;
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/training-sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(items),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo guardar la asistencia");
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Asistencia guardada.";
      setTimeout(closeAttendance, 800);
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  function setAllAttendance(status) {
    const radios = document.querySelectorAll("#attendanceRoster input[type='radio']");
    radios.forEach((element) => {
      if (element.value === status) {
        element.checked = true;
      }
    });
  }

  window.DashboardOperations = {
    loadAdminTrainingSessions,
    loadCoachTrainingSessions,
    getLevelLabelMap,
    adminPrevMonth,
    adminNextMonth,
    coachPrevMonth,
    coachNextMonth,
    openCreateSession,
    openEditSession,
    closeCreateSession,
    handleFrequencyChange,
    toggleLevelDropdown,
    handleLevelCategoryLock,
    saveCreateSession,
    cancelSession,
    cancelSeries,
    openAttendance,
    closeAttendance,
    saveAttendance,
    setAllAttendance,
  };
})();