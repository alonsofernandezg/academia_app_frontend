// =====================================================
// ⚽ CONVOCATORIAS (CALLUPS) — Dashboard-integrated
// =====================================================
// Depends on dashboard.js globals: API_URL, token, role, authHeaders(),
// showConfirmModal(), showAlertModal()

// State
let currentCallupId = null;
let currentScope = "main";
let callupsAcademiesCache = [];
let callupsCategoriesCache = [];
let callupsLevelsCache = [];
let callupsCoachesCache = [];
let coachActiveAssignments = []; // coach's active memberships

// --------------------------------------------------
// Helpers (callup-specific)
// --------------------------------------------------

function callupShowMsg(elId, text, isError) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = isError
    ? "w3-small w3-text-red w3-center"
    : "w3-small w3-text-green w3-center";
  el.textContent = text;
}

function statusLabel(status) {
  const map = {
    draft: { text: "Borrador", color: "w3-yellow" },
    sent: { text: "Enviada", color: "w3-blue" },
    completed: { text: "Completada", color: "w3-green" },
    cancelled: { text: "Cancelada", color: "w3-red" },
  };
  const s = map[status] || { text: status, color: "w3-gray" };
  return `<span class="w3-tag w3-round ${s.color}" style="font-size:11px">${s.text}</span>`;
}

function eventTypeLabel(type) {
  const map = { fogueo: "Fogueo", campeonato: "Campeonato" };
  return map[type] || type;
}

function venueLabel(venue) {
  const map = { local: "🏠 Local", visita: "✈️ Visita" };
  return map[venue] || venue;
}

// --------------------------------------------------
// Init — called from dashboard.js window.load
// --------------------------------------------------

async function initCallups() {
  // If coach role, move callup content from hidden adminPanel into coachPanel
  if (role === "coach") {
    const source = document.getElementById("adminCallupsContent");
    const target = document.getElementById("coachCallupsContent");
    if (source && target) {
      target.innerHTML = ""; // remove placeholder
      while (source.firstChild) {
        target.appendChild(source.firstChild);
      }
    }
  }

  await loadCallupsAcademies();

  // If coach, pre-load their active assignments for auto-fill
  if (role === "coach") {
    await loadCoachActiveAssignments();
    // Auto-select academy in filter and load callups list
    if (coachActiveAssignments.length > 0) {
      const filterAcademy = document.getElementById("filterAcademy");
      if (filterAcademy && coachActiveAssignments[0].academy_id) {
        filterAcademy.value = String(coachActiveAssignments[0].academy_id);
        await loadCallups();
      }
    }
  }
}

// --------------------------------------------------
// Load academies (for filters + create form)
// --------------------------------------------------

async function loadCallupsAcademies() {
  try {
    const res = await fetch(`${API_URL}/academies/`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Error cargando academias");
    callupsAcademiesCache = await res.json();

    const filterSel = document.getElementById("filterAcademy");
    const createSel = document.getElementById("cAcademy");

    if (filterSel) {
      filterSel.innerHTML = `<option value="">Seleccionar…</option>` +
        callupsAcademiesCache.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    }

    if (createSel) {
      createSel.innerHTML = `<option value="">Seleccionar…</option>` +
        callupsAcademiesCache.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    }
  } catch (err) {
    console.error(err);
  }
}

// --------------------------------------------------
// Load categories for academy
// --------------------------------------------------

async function loadCallupCategories(academyId) {
  try {
    const res = await fetch(`${API_URL}/categories/?academy_id=${academyId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Error cargando categorías");
    callupsCategoriesCache = await res.json();
    return callupsCategoriesCache;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// --------------------------------------------------
// Load levels for category
// --------------------------------------------------

async function loadCallupLevels(categoryId) {
  try {
    const res = await fetch(`${API_URL}/levels/?category_id=${categoryId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Error cargando niveles");
    callupsLevelsCache = await res.json();
    return callupsLevelsCache;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// --------------------------------------------------
// Load coaches
// --------------------------------------------------

async function loadCallupCoachesForSelect() {
  try {
    const res = await fetch(`${API_URL}/coaches/`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Error cargando entrenadores");
    callupsCoachesCache = await res.json();

    const sel = document.getElementById("cCoach");
    if (sel) {
      sel.innerHTML = `<option value="">Seleccionar…</option>` +
        callupsCoachesCache
          .filter(c => c.is_active)
          .map(c => `<option value="${c.user_id}">${c.full_name}</option>`)
          .join("");
    }
  } catch (err) {
    console.error(err);
  }
}

// --------------------------------------------------
// Load coach active assignments (for auto-fill)
// --------------------------------------------------

async function loadCoachActiveAssignments() {
  try {
    const res = await fetch(`${API_URL}/admin/coach-assignments/my/active`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    coachActiveAssignments = await res.json();
  } catch (err) {
    console.error("Error loading coach assignments:", err);
    coachActiveAssignments = [];
  }
}

// --------------------------------------------------
// Cascading selectors (create form)
// --------------------------------------------------

async function onAcademyChange() {
  const academyId = document.getElementById("cAcademy").value;
  const catSel = document.getElementById("cCategory");
  const lvlSel = document.getElementById("cLevel");
  catSel.innerHTML = `<option value="">Cargando…</option>`;
  lvlSel.innerHTML = `<option value="">Todos los niveles</option>`;

  if (!academyId) {
    catSel.innerHTML = `<option value="">Seleccionar academia primero</option>`;
    return;
  }

  const cats = await loadCallupCategories(academyId);
  catSel.innerHTML = `<option value="">Seleccionar…</option>` +
    cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  await loadCallupCoachesForSelect();
}

async function onCategoryChange() {
  const catId = document.getElementById("cCategory").value;
  const lvlSel = document.getElementById("cLevel");
  lvlSel.innerHTML = `<option value="">Todos los niveles</option>`;

  if (!catId) return;

  const levels = await loadCallupLevels(catId);
  lvlSel.innerHTML = `<option value="">Todos los niveles</option>` +
    levels.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
}

function onLevelChange() {
  // Optionally auto-resolve coach when level changes
}

// --------------------------------------------------
// Auto-resolve coach
// --------------------------------------------------

async function autoResolveCoach() {
  const academyId = document.getElementById("cAcademy").value;
  const categoryId = document.getElementById("cCategory").value;
  const levelId = document.getElementById("cLevel").value || null;
  const msgEl = document.getElementById("coachResolveMsg");

  if (!academyId || !categoryId) {
    msgEl.textContent = "Selecciona academia y categoría primero.";
    return;
  }

  try {
    let url = `${API_URL}/callups/resolve-coach?academy_id=${academyId}&category_id=${categoryId}`;
    if (levelId) url += `&level_id=${levelId}`;

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    if (data.auto_resolved && data.coaches.length === 1) {
      document.getElementById("cCoach").value = data.coaches[0].coach_user_id;
      msgEl.className = "w3-small w3-text-green w3-margin-top";
      msgEl.textContent = `✅ Auto-resuelto: ${data.coaches[0].coach_name}`;
    } else if (data.coaches.length > 1) {
      msgEl.className = "w3-small w3-text-orange w3-margin-top";
      msgEl.textContent = `⚠️ ${data.coaches.length} entrenadores encontrados. Selecciona manualmente.`;
    } else {
      msgEl.className = "w3-small w3-text-red w3-margin-top";
      msgEl.textContent = "❌ No se encontró entrenador activo para esta combinación.";
    }
  } catch (err) {
    msgEl.className = "w3-small w3-text-red w3-margin-top";
    msgEl.textContent = err.message;
  }
}

// --------------------------------------------------
// Show/hide views (within the callups card)
// --------------------------------------------------

function showCreateForm() {
  document.getElementById("callupListSection").classList.add("w3-hide");
  document.getElementById("callupCreateSection").classList.remove("w3-hide");
  document.getElementById("callupDetailSection").classList.add("w3-hide");
  document.getElementById("createMsg").textContent = "";

  // If coach, auto-fill from their active assignment
  if (role === "coach" && coachActiveAssignments.length > 0) {
    autoFillCoachCreateForm();
  }
}

async function autoFillCoachCreateForm() {
  const assignment = coachActiveAssignments[0]; // primary assignment
  const coachUserId = getUserId();

  // Auto-select academy
  const academySel = document.getElementById("cAcademy");
  if (academySel && assignment.academy_id) {
    academySel.value = String(assignment.academy_id);
    // Trigger category load
    const cats = await loadCallupCategories(assignment.academy_id);
    const catSel = document.getElementById("cCategory");
    if (catSel) {
      catSel.innerHTML = `<option value="">Seleccionar…</option>` +
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

      if (assignment.category_id) {
        catSel.value = String(assignment.category_id);
        // Trigger level load
        const levels = await loadCallupLevels(assignment.category_id);
        const lvlSel = document.getElementById("cLevel");
        if (lvlSel) {
          lvlSel.innerHTML = `<option value="">Todos los niveles</option>` +
            levels.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
          if (assignment.level_id) {
            lvlSel.value = String(assignment.level_id);
          }
        }
      }
    }
  }

  // Auto-select coach (themselves) — coach can't call GET /coaches/ (admin-only)
  // Instead, fetch own coach profile and fill select directly
  const coachSel = document.getElementById("cCoach");
  if (coachSel && coachUserId) {
    try {
      const res = await fetch(`${API_URL}/coaches/user/${coachUserId}`, { headers: authHeaders() });
      if (res.ok) {
        const coachData = await res.json();
        coachSel.innerHTML = `<option value="${coachData.user_id}" selected>${coachData.full_name}</option>`;
      } else {
        // Fallback: just set value with user_id
        coachSel.innerHTML = `<option value="${coachUserId}" selected>Yo (Entrenador)</option>`;
      }
    } catch {
      coachSel.innerHTML = `<option value="${coachUserId}" selected>Yo (Entrenador)</option>`;
    }
  }

  // Show resolve message
  const msgEl = document.getElementById("coachResolveMsg");
  if (msgEl) {
    msgEl.className = "w3-small w3-text-green w3-margin-top";
    msgEl.textContent = "✅ Datos pre-llenados desde tu asignación activa.";
  }
}

function hideCreateForm() {
  document.getElementById("callupCreateSection").classList.add("w3-hide");
  document.getElementById("callupListSection").classList.remove("w3-hide");
}

function showDetail() {
  document.getElementById("callupListSection").classList.add("w3-hide");
  document.getElementById("callupCreateSection").classList.add("w3-hide");
  document.getElementById("callupDetailSection").classList.remove("w3-hide");
}

function backToList() {
  document.getElementById("callupDetailSection").classList.add("w3-hide");
  document.getElementById("callupListSection").classList.remove("w3-hide");
  currentCallupId = null;
  loadCallups();
}

// --------------------------------------------------
// CRUD: Load callups list
// --------------------------------------------------

async function loadCallups() {
  const academyId = document.getElementById("filterAcademy").value;
  const status = document.getElementById("filterStatus").value;
  const list = document.getElementById("callupsList");

  if (!academyId) {
    list.innerHTML = `<div class="w3-center w3-text-gray w3-small">Selecciona una academia.</div>`;
    return;
  }

  list.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando…</div>`;

  try {
    let url = `${API_URL}/callups/?academy_id=${academyId}`;
    if (status) url += `&status=${status}`;

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    const items = data.items || [];
    if (!items.length) {
      list.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay convocatorias.</div>`;
      return;
    }

    list.innerHTML = items.map(c => `
      <div class="w3-card w3-round-xlarge w3-padding w3-margin-bottom w3-hover-shadow"
           style="cursor:pointer" onclick="loadCallupDetail(${c.id})">
        <div class="w3-row">
          <div class="w3-col s8">
            <b>${c.title}</b> ${statusLabel(c.status)}
            <br>
            <span class="w3-small w3-text-gray">
              ${eventTypeLabel(c.event_type)} · ${c.event_date} · ${c.event_time}
              ${c.opponent ? '· vs ' + c.opponent : ''}
            </span>
            <br>
            <span class="w3-small w3-text-gray">
              📍 ${c.location} · ${venueLabel(c.venue)} · ${c.category_name || ''}${c.level_name ? ' / ' + c.level_name : ''}
            </span>
          </div>
          <div class="w3-col s4 w3-right-align">
            <span class="w3-small w3-text-gray">🏃 ${c.players_count} jugadores</span><br>
            <span class="w3-small w3-text-gray">👤 ${c.coach_name || ''}</span>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    list.innerHTML = `<div class="w3-center w3-text-red w3-small">${err.message}</div>`;
  }
}

// --------------------------------------------------
// CRUD: Create callup
// --------------------------------------------------

async function createCallup() {
  const title = document.getElementById("cTitle").value.trim();
  const event_type = document.getElementById("cEventType").value;
  const event_date = document.getElementById("cEventDate").value;
  const event_time = document.getElementById("cEventTime").value;
  const location = document.getElementById("cLocation").value.trim();
  const venue = document.getElementById("cVenue").value;
  const opponent = document.getElementById("cOpponent").value.trim() || null;
  const description = document.getElementById("cDescription").value.trim() || null;
  const academy_id = parseInt(document.getElementById("cAcademy").value);
  const category_id = parseInt(document.getElementById("cCategory").value);
  const levelVal = document.getElementById("cLevel").value;
  const level_id = levelVal ? parseInt(levelVal) : null;
  const coach_user_id = parseInt(document.getElementById("cCoach").value);

  if (!title || !event_date || !event_time || !location || !academy_id || !category_id || !coach_user_id) {
    callupShowMsg("createMsg", "Completa todos los campos obligatorios (*)", true);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/callups`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title, event_type, event_date, event_time, location, venue,
        opponent, description, academy_id, category_id, level_id, coach_user_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al crear");

    callupShowMsg("createMsg", "✅ Convocatoria creada", false);
    setTimeout(() => {
      hideCreateForm();
      document.getElementById("filterAcademy").value = academy_id;
      loadCallups();
    }, 600);
  } catch (err) {
    callupShowMsg("createMsg", err.message, true);
  }
}

// --------------------------------------------------
// CRUD: Load callup detail
// --------------------------------------------------

async function loadCallupDetail(callupId) {
  currentCallupId = callupId;
  showDetail();

  try {
    const res = await fetch(`${API_URL}/callups/${callupId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    document.getElementById("detailTitle").textContent = data.title;

    document.getElementById("detailInfo").innerHTML = `
      <div class="w3-row-padding">
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Estado</span><br>${statusLabel(data.status)}
        </div>
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Tipo</span><br>${eventTypeLabel(data.event_type)}
        </div>
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Fecha / Hora</span><br>${data.event_date} · ${data.event_time}
        </div>
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Ubicación</span><br>📍 ${data.location}
        </div>
      </div>
      <div class="w3-row-padding w3-margin-top">
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Localía</span><br>${venueLabel(data.venue)}
        </div>
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Oponente</span><br>${data.opponent || '—'}
        </div>
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Categoría / Nivel</span><br>
          ${data.category_name || ''}${data.level_name ? ' / ' + data.level_name : ''}
        </div>
        <div class="w3-col s6 m3">
          <span class="w3-small w3-text-gray">Entrenador</span><br>👤 ${data.coach_name || ''}
        </div>
      </div>
      <div class="w3-row-padding w3-margin-top">
        <div class="w3-col s12">
          <span class="w3-small w3-text-gray">Descripción</span><br>${data.description || '—'}
        </div>
      </div>
    `;

    // Players
    renderPlayers(data.players || [], data.category_id);
    document.getElementById("detailPlayersCount").textContent = data.players_count || 0;

    // Action buttons
    renderActionButtons(data);

    // Invoice summary panel (T012) + generation UI (T011)
    await renderInvoiceSection(data);

    // Show/hide add panel based on status
    const addPanel = document.getElementById("addPlayersPanel");
    if (data.status === "draft" || data.status === "sent") {
      addPanel.classList.remove("w3-hide");
      currentScope = "main";
      setActiveScope("main");
      loadAvailableAthletes(callupId, "main");
    } else {
      addPanel.classList.add("w3-hide");
    }

  } catch (err) {
    document.getElementById("detailInfo").innerHTML =
      `<div class="w3-text-red w3-small">${err.message}</div>`;
  }
}

// --------------------------------------------------
// Render players
// --------------------------------------------------

function renderPlayers(players, callupCategoryId) {
  const container = document.getElementById("detailPlayersList");
  if (!players.length) {
    container.innerHTML = `<div class="w3-center w3-text-gray w3-small w3-padding">Sin jugadores convocados.</div>`;
    return;
  }

  container.innerHTML = players.map(p => {
    let badge = "";
    if (p.is_from_main_level) {
      badge = `<span class="badge badge-main">Principal</span>`;
    } else if (p.source_category_id !== null && p.source_category_id !== callupCategoryId) {
      badge = `<span class="badge badge-external">Otra Cat: ${p.source_category_name || "?"}${p.source_level_name ? " / " + p.source_level_name : ""}</span>`;
    } else if (p.source_category_id !== null) {
      badge = `<span class="badge badge-other">Otro Nivel: ${p.source_level_name || "?"}</span>`;
    }

    const name = `${p.athlete_first_name || "?"} ${p.athlete_last_name || ""}`;
    const canRemove = document.getElementById("addPlayersPanel") &&
                      !document.getElementById("addPlayersPanel").classList.contains("w3-hide");

    return `
      <div class="player-row">
        <div>
          <b>${name}</b> ${badge}
        </div>
        ${canRemove ? `<button class="w3-button w3-tiny w3-red w3-round" onclick="removePlayer(${p.id})">✕</button>` : ""}
      </div>
    `;
  }).join("");
}

// --------------------------------------------------
// Available athletes
// --------------------------------------------------

async function loadAvailableAthletes(callupId, scope) {
  const container = document.getElementById("availableAthletesList");
  container.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando atletas…</div>`;

  try {
    const res = await fetch(
      `${API_URL}/callups/${callupId}/available-athletes?scope=${scope}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    if (!data.athletes.length) {
      container.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay atletas disponibles en este alcance.</div>`;
      return;
    }

    container.innerHTML = data.athletes.map(a => {
      const badge = a.is_from_main_level
        ? `<span class="badge badge-main">Principal</span>`
        : `<span class="badge badge-other">${a.category_name || ""}${a.level_name ? " / " + a.level_name : ""}</span>`;

      return `
        <label class="player-row" style="cursor:pointer">
          <div>
            <input type="checkbox" class="w3-check athlete-check" value="${a.athlete_id}">
            &nbsp; <b>${a.first_name} ${a.last_name}</b> ${badge}
          </div>
          <span class="w3-small w3-text-gray">
            ${a.category_name || ""}${a.level_name ? " / " + a.level_name : ""}
          </span>
        </label>
      `;
    }).join("");

  } catch (err) {
    container.innerHTML = `<div class="w3-text-red w3-small">${err.message}</div>`;
  }
}

// --------------------------------------------------
// Scope tabs
// --------------------------------------------------

function changeScope(scope) {
  currentScope = scope;
  setActiveScope(scope);
  if (currentCallupId) {
    loadAvailableAthletes(currentCallupId, scope);
  }
}

function setActiveScope(scope) {
  document.querySelectorAll(".scope-tabs button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.scope === scope);
  });
}

// --------------------------------------------------
// Add selected players
// --------------------------------------------------

async function addSelectedPlayers() {
  const checks = document.querySelectorAll(".athlete-check:checked");
  const ids = Array.from(checks).map(c => parseInt(c.value));

  if (!ids.length) {
    showAlertModal("Selecciona al menos un atleta.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/callups/${currentCallupId}/players`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ athlete_ids: ids }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    loadCallupDetail(currentCallupId);
  } catch (err) {
    showAlertModal(err.message);
  }
}

// --------------------------------------------------
// Remove player
// --------------------------------------------------

async function removePlayer(playerId) {
  const ok = await showConfirmModal("¿Remover este jugador de la convocatoria?");
  if (!ok) return;

  try {
    const res = await fetch(`${API_URL}/callups/${currentCallupId}/players/${playerId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Error");
    }

    loadCallupDetail(currentCallupId);
  } catch (err) {
    showAlertModal(err.message);
  }
}

// --------------------------------------------------
// Action buttons (send / cancel / edit / complete)
// --------------------------------------------------

function renderActionButtons(data) {
  let container = document.getElementById("detailActions");
  if (!container) {
    const detailInfo = document.getElementById("detailInfo");
    container = document.createElement("div");
    container.id = "detailActions";
    container.className = "w3-padding-small";
    detailInfo.parentNode.insertBefore(container, detailInfo.nextSibling);
  }

  const isEditable = data.status === "draft" || data.status === "sent";
  const isSent = data.status === "sent";
  const isCompleted = data.status === "completed";

  if (!isEditable && !isSent && !isCompleted) {
    container.innerHTML = "";
    return;
  }

  const sendLabel = data.status === "sent" ? "Reenviar Convocatoria" : "Enviar Convocatoria";
  const sendIcon = data.status === "sent" ? "🔄" : "📤";

  let buttons = "";

  if (isEditable) {
    buttons += `
      <button class="w3-button w3-blue w3-round w3-margin-right"
              onclick="showEditForm(${data.id})">
        ✏️ Editar
      </button>
      <button class="w3-button w3-green w3-round w3-margin-right"
              onclick="sendCallup(${data.id})"
              ${data.players_count === 0 ? 'disabled title="Agrega al menos un jugador"' : ''}>
        ${sendIcon} ${sendLabel}
      </button>
      <button class="w3-button w3-red w3-round w3-margin-right"
              onclick="cancelCallup(${data.id})">
        ❌ Cancelar
      </button>
    `;
  }

  if (isSent) {
    buttons += `
      <button class="w3-button w3-teal w3-round"
              onclick="completeCallup(${data.id})">
        ✅ Completar
      </button>
    `;
  }

  if (isCompleted) {
    buttons += `
      <button class="w3-button w3-purple w3-round"
              onclick="showMatchStatsPanel(${data.id})">
        📊 Estadísticas
      </button>
    `;
  }

  container.innerHTML = `
    <div class="w3-bar w3-margin-top">${buttons}</div>
    <div id="actionMsg" class="w3-margin-top"></div>
  `;
}

// --------------------------------------------------
// Send callup
// --------------------------------------------------

async function sendCallup(callupId) {
  const ok = await showConfirmModal("¿Enviar esta convocatoria? Se notificará a los jugadores convocados.");
  if (!ok) return;

  try {
    const res = await fetch(`${API_URL}/callups/${callupId}/send`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al enviar");

    showAlertModal("✅ Convocatoria enviada exitosamente.");
    loadCallupDetail(callupId);
  } catch (err) {
    showAlertModal("❌ " + err.message);
  }
}

// --------------------------------------------------
// Cancel callup
// --------------------------------------------------

async function cancelCallup(callupId) {
  const ok = await showConfirmModal("¿Cancelar esta convocatoria? Esta acción no se puede deshacer.");
  if (!ok) return;

  // Check if there are pending invoices
  let cancelPendingInvoices = false;
  try {
    const summaryRes = await fetch(
      `${API_URL}/callups/${callupId}/invoice-summary`,
      { headers: authHeaders() }
    );
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      if (summary.pending > 0) {
        cancelPendingInvoices = await showConfirmModal(
          `Esta convocatoria tiene ${summary.pending} factura(s) pendiente(s). ¿Deseas cancelarlas también?`
        );
      }
    }
  } catch {
    // If summary fails, proceed without cancelling invoices
  }

  try {
    const res = await fetch(`${API_URL}/callups/${callupId}/cancel`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ cancel_pending_invoices: cancelPendingInvoices }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al cancelar");

    let msg = "✅ Convocatoria cancelada.";
    if (data.cancelled_invoices > 0) {
      msg += ` ${data.cancelled_invoices} factura(s) pendiente(s) cancelada(s).`;
    }
    showAlertModal(msg);
    loadCallupDetail(callupId);
  } catch (err) {
    showAlertModal("❌ " + err.message);
  }
}

// --------------------------------------------------
// Complete callup
// --------------------------------------------------

async function completeCallup(callupId) {
  const ok = await showConfirmModal("¿Marcar esta convocatoria como completada? Solo convocatorias enviadas pueden completarse.");
  if (!ok) return;

  try {
    const res = await fetch(`${API_URL}/callups/${callupId}/complete`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al completar");

    showAlertModal("✅ Convocatoria completada.");
    loadCallupDetail(callupId);
  } catch (err) {
    showAlertModal("❌ " + err.message);
  }
}

// --------------------------------------------------
// Edit callup (inline form)
// --------------------------------------------------

let currentEditData = null;

async function showEditForm(callupId) {
  try {
    const res = await fetch(`${API_URL}/callups/${callupId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");
    currentEditData = data;
  } catch (err) {
    showAlertModal(err.message);
    return;
  }

  let editSection = document.getElementById("editFormSection");
  if (!editSection) {
    const detailSection = document.getElementById("callupDetailSection");
    editSection = document.createElement("div");
    editSection.id = "editFormSection";
    editSection.className = "w3-card w3-white w3-round-xlarge w3-padding w3-margin-top";
    detailSection.appendChild(editSection);
  }

  editSection.innerHTML = `
    <h4 class="w3-text-blue" style="margin:4px 0">✏️ Editar Convocatoria</h4>
    <div id="editMsg" class="w3-small w3-center"></div>
    <div id="editConflictWarning"></div>
    <div class="w3-row-padding">
      <div class="w3-col s12 m6">
        <label class="w3-small w3-text-gray">Título</label>
        <input id="eTitle" class="w3-input w3-border w3-round-large" type="text" maxlength="200"
               value="${currentEditData.title || ''}">
      </div>
      <div class="w3-col s12 m3">
        <label class="w3-small w3-text-gray">Tipo de Evento</label>
        <select id="eEventType" class="w3-select w3-border w3-round-large">
          <option value="fogueo" ${currentEditData.event_type === 'fogueo' ? 'selected' : ''}>Fogueo</option>
          <option value="campeonato" ${currentEditData.event_type === 'campeonato' ? 'selected' : ''}>Campeonato</option>
        </select>
      </div>
    </div>
    <div class="w3-row-padding w3-margin-top">
      <div class="w3-col s6 m3">
        <label class="w3-small w3-text-gray">Fecha</label>
        <input id="eEventDate" class="w3-input w3-border w3-round-large" type="date"
               value="${currentEditData.event_date || ''}" onchange="editCheckConflict()">
      </div>
      <div class="w3-col s6 m3">
        <label class="w3-small w3-text-gray">Hora</label>
        <input id="eEventTime" class="w3-input w3-border w3-round-large" type="time"
               value="${currentEditData.event_time || ''}">
      </div>
      <div class="w3-col s12 m3">
        <label class="w3-small w3-text-gray">Ubicación</label>
        <input id="eLocation" class="w3-input w3-border w3-round-large" type="text" maxlength="200"
               value="${currentEditData.location || ''}">
      </div>
      <div class="w3-col s12 m3">
        <label class="w3-small w3-text-gray">Localía</label>
        <select id="eVenue" class="w3-select w3-border w3-round-large">
          <option value="local" ${currentEditData.venue === 'local' ? 'selected' : ''}>Local</option>
          <option value="visita" ${currentEditData.venue === 'visita' ? 'selected' : ''}>Visita</option>
        </select>
      </div>
    </div>
    <div class="w3-row-padding w3-margin-top">
      <div class="w3-col s12 m6">
        <label class="w3-small w3-text-gray">Oponente</label>
        <input id="eOpponent" class="w3-input w3-border w3-round-large" type="text" maxlength="200"
               value="${currentEditData.opponent || ''}">
      </div>
      <div class="w3-col s12 m6">
        <label class="w3-small w3-text-gray">Descripción</label>
        <textarea id="eDescription" class="w3-input w3-border w3-round-large" rows="2">${currentEditData.description || ''}</textarea>
      </div>
    </div>
    <div class="w3-row-padding w3-margin-top">
      <div class="w3-col s12 w3-right-align">
        <button class="w3-button w3-white w3-border w3-round-xxlarge w3-small" onclick="hideEditForm()">Cancelar</button>
        <button class="w3-button w3-blue w3-round-xxlarge w3-small w3-margin-left" onclick="updateCallup(${currentEditData.id})">Guardar Cambios</button>
      </div>
    </div>
  `;

  editSection.classList.remove("w3-hide");
}

function hideEditForm() {
  const editSection = document.getElementById("editFormSection");
  if (editSection) {
    editSection.classList.add("w3-hide");
    editSection.innerHTML = "";
  }
  currentEditData = null;
}

async function updateCallup(callupId) {
  const updates = {};

  const title = document.getElementById("eTitle").value.trim();
  const event_type = document.getElementById("eEventType").value;
  const event_date = document.getElementById("eEventDate").value;
  const event_time = document.getElementById("eEventTime").value;
  const location = document.getElementById("eLocation").value.trim();
  const venue = document.getElementById("eVenue").value;
  const opponent = document.getElementById("eOpponent").value.trim();
  const description = document.getElementById("eDescription").value.trim();

  if (title && title !== currentEditData.title) updates.title = title;
  if (event_type !== currentEditData.event_type) updates.event_type = event_type;
  if (event_date && event_date !== currentEditData.event_date) updates.event_date = event_date;
  if (event_time && event_time !== currentEditData.event_time) updates.event_time = event_time;
  if (location && location !== currentEditData.location) updates.location = location;
  if (venue !== currentEditData.venue) updates.venue = venue;
  if (opponent !== (currentEditData.opponent || "")) updates.opponent = opponent || null;
  if (description !== (currentEditData.description || "")) updates.description = description || null;

  if (Object.keys(updates).length === 0) {
    callupShowMsg("editMsg", "No hay cambios para guardar.", true);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/callups/${callupId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al actualizar");

    hideEditForm();
    showAlertModal("✅ Convocatoria actualizada.");
    loadCallupDetail(callupId);
  } catch (err) {
    callupShowMsg("editMsg", err.message, true);
  }
}

// --------------------------------------------------
// Check date conflict
// --------------------------------------------------

async function checkDateConflict(academyId, categoryId, eventDate, warningElId) {
  const warningEl = document.getElementById(warningElId);
  if (!warningEl) return;
  if (!academyId || !categoryId || !eventDate) {
    warningEl.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/callups/check-conflict?academy_id=${academyId}&category_id=${categoryId}&event_date=${eventDate}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) return;

    if (data.has_conflict) {
      const conflicts = data.conflicting_callups.map(
        c => `"${c.title}" (${c.event_time}, ${c.status})`
      ).join(", ");
      warningEl.innerHTML = `
        <div class="w3-panel w3-pale-yellow w3-border w3-border-yellow w3-round-large w3-small">
          ⚠️ <b>Conflicto de fecha:</b> Ya existen convocatorias para esta categoría en la misma fecha: ${conflicts}
        </div>
      `;
    } else {
      warningEl.innerHTML = "";
    }
  } catch {
    // Silently ignore conflict check errors
  }
}

async function editCheckConflict() {
  if (!currentEditData) return;
  const eventDate = document.getElementById("eEventDate").value;
  await checkDateConflict(
    currentEditData.academy_id,
    currentEditData.category_id,
    eventDate,
    "editConflictWarning"
  );
}

async function createCheckConflict() {
  const academyId = document.getElementById("cAcademy").value;
  const categoryId = document.getElementById("cCategory").value;
  const eventDate = document.getElementById("cEventDate").value;
  await checkDateConflict(academyId, categoryId, eventDate, "createConflictWarning");
}

// --------------------------------------------------
// T011 + T012: Invoice generation UI & summary panel
// --------------------------------------------------

async function renderInvoiceSection(callupData) {
  // Remove previous invoice section if it exists
  const existing = document.getElementById("invoiceSection");
  if (existing) existing.remove();

  const isEditable = callupData.status === "draft" || callupData.status === "sent";

  // Create container
  const section = document.createElement("div");
  section.id = "invoiceSection";
  section.className = "w3-margin-top";

  // Insert after detailActions
  const detailActions = document.getElementById("detailActions");
  if (detailActions && detailActions.parentNode) {
    detailActions.parentNode.insertBefore(section, detailActions.nextSibling);
  } else {
    const detailInfo = document.getElementById("detailInfo");
    if (detailInfo) detailInfo.parentNode.appendChild(section);
  }

  // Load invoice summary
  let summary = null;
  try {
    const res = await fetch(
      `${API_URL}/callups/${callupData.id}/invoice-summary`,
      { headers: authHeaders() }
    );
    if (res.ok) {
      summary = await res.json();
    }
  } catch {
    // Silently ignore
  }

  let html = "";

  // ── T012: Summary panel ──
  html += `<div class="w3-card w3-round-large w3-padding w3-margin-top" style="background:#f9f9f9">`;
  html += `<h5 style="margin-top:0">💰 Facturación</h5>`;

  if (!summary || summary.total_invoices === 0) {
    html += `<div class="w3-text-gray w3-small">No se han generado facturas para esta convocatoria.</div>`;
  } else {
    const pct = summary.total_expected > 0
      ? Math.round((summary.total_collected / summary.total_expected) * 100)
      : 0;

    if (summary.all_paid) {
      html += `<div class="w3-tag w3-green w3-round w3-margin-bottom" style="font-size:12px">✅ Todas las facturas pagadas</div>`;
    }

    html += `
      <div class="w3-row-padding">
        <div class="w3-col s6 m3 w3-center">
          <div class="w3-large"><b>${summary.total_invoices}</b></div>
          <div class="w3-tiny w3-text-gray">Total</div>
        </div>
        <div class="w3-col s6 m3 w3-center">
          <div class="w3-large w3-text-orange"><b>${summary.pending}</b></div>
          <div class="w3-tiny w3-text-gray">Pendientes</div>
        </div>
        <div class="w3-col s6 m3 w3-center">
          <div class="w3-large w3-text-blue"><b>${summary.submitted}</b></div>
          <div class="w3-tiny w3-text-gray">En revisión</div>
        </div>
        <div class="w3-col s6 m3 w3-center">
          <div class="w3-large w3-text-green"><b>${summary.paid}</b></div>
          <div class="w3-tiny w3-text-gray">Pagadas</div>
        </div>
      </div>
      <div class="w3-margin-top w3-small">
        <b>Recaudado:</b> ₡${Number(summary.total_collected).toLocaleString()} / ₡${Number(summary.total_expected).toLocaleString()}
        <span class="w3-text-gray">(${pct}%)</span>
      </div>
    `;

    if (summary.cancelled > 0) {
      html += `<div class="w3-small w3-text-gray w3-margin-top">Canceladas: ${summary.cancelled}</div>`;
    }
  }

  // ── T011: Generation UI (only for editable callups) ──
  if (isEditable) {
    html += `
      <hr style="margin:12px 0">
      <div class="w3-row-padding">
        <div class="w3-col s6 m4">
          <label class="w3-small">Monto por atleta (₡)</label>
          <input id="invoiceAmount" type="number" min="1" step="any"
                 class="w3-input w3-border w3-round" placeholder="Ej: 15000">
        </div>
        <div class="w3-col s6 m4" style="padding-top:18px">
          <button class="w3-button w3-teal w3-round w3-small"
                  onclick="generateCallupInvoices(${callupData.id})">
            🧾 Generar Facturas
          </button>
        </div>
      </div>
      <div id="invoiceGenMsg" class="w3-margin-top"></div>
    `;
  }

  html += `</div>`;
  section.innerHTML = html;
}

async function generateCallupInvoices(callupId) {
  const amountInput = document.getElementById("invoiceAmount");
  const msgEl = document.getElementById("invoiceGenMsg");
  const amount = parseFloat(amountInput ? amountInput.value : "0");

  if (!amount || amount <= 0) {
    if (msgEl) {
      msgEl.innerHTML = `<div class="w3-text-red w3-small">Ingresa un monto válido mayor a cero.</div>`;
    }
    return;
  }

  if (msgEl) {
    msgEl.innerHTML = `<div class="w3-text-gray w3-small">Generando facturas...</div>`;
  }

  try {
    const res = await fetch(`${API_URL}/callups/${callupId}/generate-invoices`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();

    if (res.status === 400) {
      // All already invoiced or validation error — show info toast
      if (msgEl) {
        msgEl.innerHTML = `<div class="w3-pale-yellow w3-border w3-border-yellow w3-round w3-padding-small w3-small">ℹ️ ${data.detail}</div>`;
      }
      return;
    }

    if (!res.ok) throw new Error(data.detail || "Error al generar facturas");

    // Success: show summary
    let msg = `✅ ${data.created} factura(s) creada(s).`;
    if (data.skipped > 0) {
      msg += ` ${data.skipped} omitida(s) (ya existían).`;
    }

    let warningHtml = "";
    if (data.warnings && data.warnings.length > 0) {
      warningHtml = data.warnings.map(w =>
        `<div class="w3-pale-yellow w3-border w3-border-yellow w3-round w3-padding-small w3-small w3-margin-top">⚠️ ${w}</div>`
      ).join("");
    }

    if (msgEl) {
      msgEl.innerHTML = `<div class="w3-text-green w3-small">${msg}</div>${warningHtml}`;
    }

    // Refresh the detail to update summary panel
    setTimeout(() => loadCallupDetail(callupId), 1500);

  } catch (err) {
    if (msgEl) {
      msgEl.innerHTML = `<div class="w3-text-red w3-small">❌ ${err.message}</div>`;
    }
  }
}

// =====================================================
// 📊 MATCH STATISTICS (Estadísticas de Partido)
// =====================================================

let currentStatsCallupId = null;
let currentStatsPlayers = [];
let currentMatchStats = null;

function halfLabel(half) {
  const map = {
    first: "1T",
    second: "2T",
    extra_first: "TE1",
    extra_second: "TE2"
  };
  return map[half] || half;
}

function resultLabel(result) {
  const map = {
    won: { text: "Victoria", color: "w3-green", icon: "🏆" },
    draw: { text: "Empate", color: "w3-yellow", icon: "🤝" },
    lost: { text: "Derrota", color: "w3-red", icon: "😞" }
  };
  const r = map[result] || { text: result, color: "w3-gray", icon: "❓" };
  return `<span class="w3-tag w3-round ${r.color}" style="font-size:12px">${r.icon} ${r.text}</span>`;
}

async function showMatchStatsPanel(callupId) {
  currentStatsCallupId = callupId;

  // First load players from callup detail
  try {
    const res = await fetch(`${API_URL}/callups/${callupId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");
    currentStatsPlayers = data.players || [];
  } catch (err) {
    showAlertModal("Error al cargar jugadores: " + err.message);
    return;
  }

  // Load existing stats (or create structure)
  try {
    const res = await fetch(`${API_URL}/callups/${callupId}/stats`, { headers: authHeaders() });
    if (res.ok) {
      currentMatchStats = await res.json();
    } else if (res.status === 404) {
      currentMatchStats = null;
    } else {
      const errData = await res.json();
      throw new Error(errData.detail || "Error");
    }
  } catch (err) {
    if (!err.message.includes("No hay estadísticas")) {
      showAlertModal("Error al cargar estadísticas: " + err.message);
      return;
    }
    currentMatchStats = null;
  }

  renderMatchStatsPanel();
}

function renderMatchStatsPanel() {
  // Remove existing panel
  const existing = document.getElementById("matchStatsPanel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "matchStatsPanel";
  panel.className = "w3-card w3-white w3-round-xlarge w3-padding w3-margin-top";

  // Insert after invoiceSection or detailActions
  const invoiceSection = document.getElementById("invoiceSection");
  const detailActions = document.getElementById("detailActions");
  const insertAfter = invoiceSection || detailActions;
  if (insertAfter && insertAfter.parentNode) {
    insertAfter.parentNode.insertBefore(panel, insertAfter.nextSibling);
  }

  const goalsAgainst = currentMatchStats?.goals_against ?? 0;
  const notes = currentMatchStats?.notes ?? "";
  const goalsFor = currentMatchStats?.goals_for ?? 0;
  const result = currentMatchStats?.result;

  let headerHtml = `<h4 class="w3-text-purple" style="margin:4px 0">📊 Estadísticas del Partido</h4>`;
  if (currentMatchStats) {
    headerHtml += `
      <div class="w3-margin-bottom">
        <span class="w3-xlarge"><b>${goalsFor}</b></span>
        <span class="w3-text-gray">-</span>
        <span class="w3-xlarge"><b>${goalsAgainst}</b></span>
        <span class="w3-margin-left">${resultLabel(result)}</span>
      </div>
    `;
  }

  // Match info (goals against, notes)
  let matchInfoHtml = `
    <div class="w3-row-padding">
      <div class="w3-col s6 m3">
        <label class="w3-small w3-text-gray">Goles en Contra</label>
        <input id="statsGoalsAgainst" type="number" min="0" max="99" 
               class="w3-input w3-border w3-round-large" value="${goalsAgainst}">
      </div>
      <div class="w3-col s12 m9">
        <label class="w3-small w3-text-gray">Notas</label>
        <input id="statsNotes" type="text" maxlength="500" 
               class="w3-input w3-border w3-round-large" value="${notes}" placeholder="Observaciones del partido...">
      </div>
    </div>
  `;

  // Player stats table
  let playersHtml = `
    <div class="w3-margin-top">
      <table class="w3-table w3-bordered w3-small" style="border-collapse:collapse">
        <thead>
          <tr class="w3-light-gray">
            <th style="min-width:150px">Jugador</th>
            <th style="width:60px;text-align:center">⏱️ Min</th>
            <th style="width:60px;text-align:center">⚽ Goles</th>
            <th style="width:60px;text-align:center">🅰️ Asist</th>
            <th style="width:60px;text-align:center">🟨 TA</th>
            <th style="width:50px;text-align:center">🟥 TR</th>
          </tr>
        </thead>
        <tbody id="statsPlayersBody">
        </tbody>
      </table>
    </div>
  `;

  // Buttons
  let buttonsHtml = `
    <div class="w3-row-padding w3-margin-top">
      <div class="w3-col s12 w3-right-align">
        <button class="w3-button w3-white w3-border w3-round-xxlarge w3-small" onclick="hideMatchStatsPanel()">Cerrar</button>
        <button class="w3-button w3-purple w3-round-xxlarge w3-small w3-margin-left" onclick="saveMatchStats()">💾 Guardar Estadísticas</button>
      </div>
    </div>
    <div id="statsMsg" class="w3-margin-top w3-small w3-center"></div>
  `;

  panel.innerHTML = headerHtml + matchInfoHtml + playersHtml + buttonsHtml;

  // Populate player rows
  renderStatsPlayerRows();
}

function renderStatsPlayerRows() {
  const tbody = document.getElementById("statsPlayersBody");
  if (!tbody) return;

  tbody.innerHTML = currentStatsPlayers.map(p => {
    const name = `${p.athlete_first_name || "?"} ${p.athlete_last_name || ""}`;
    const cpId = p.id; // callup_player_id

    // Find existing stats for this player
    const existingPs = currentMatchStats?.player_stats?.find(ps => ps.callup_player_id === cpId);
    const minutes = existingPs?.minutes_played ?? 0;
    const assists = existingPs?.assists ?? 0;
    const yellowCards = existingPs?.yellow_cards ?? 0;
    const redCard = existingPs?.red_card ?? false;
    const goals = existingPs?.goals || [];

    return `
      <tr data-cpid="${cpId}">
        <td>
          <b>${name}</b>
          <div id="goalsContainer_${cpId}" class="w3-margin-top">
            ${renderPlayerGoals(cpId, goals)}
          </div>
        </td>
        <td style="text-align:center">
          <input type="number" min="0" max="120" class="w3-input w3-border w3-round w3-small stat-minutes" 
                 data-cpid="${cpId}" value="${minutes}" style="width:55px;text-align:center">
        </td>
        <td style="text-align:center">
          <div class="w3-bar">
            <span id="goalsCount_${cpId}" class="w3-margin-right">${goals.length}</span>
            <button class="w3-button w3-tiny w3-green w3-round" onclick="addGoalToPlayer(${cpId})" title="Agregar gol">+</button>
          </div>
        </td>
        <td style="text-align:center">
          <input type="number" min="0" max="20" class="w3-input w3-border w3-round w3-small stat-assists" 
                 data-cpid="${cpId}" value="${assists}" style="width:55px;text-align:center">
        </td>
        <td style="text-align:center">
          <select class="w3-select w3-border w3-round w3-small stat-yellow" data-cpid="${cpId}" style="width:55px">
            <option value="0" ${yellowCards === 0 ? 'selected' : ''}>0</option>
            <option value="1" ${yellowCards === 1 ? 'selected' : ''}>1</option>
            <option value="2" ${yellowCards === 2 ? 'selected' : ''}>2</option>
          </select>
        </td>
        <td style="text-align:center">
          <input type="checkbox" class="w3-check stat-red" data-cpid="${cpId}" ${redCard ? 'checked' : ''}>
        </td>
      </tr>
    `;
  }).join("");
}

function renderPlayerGoals(cpId, goals) {
  if (!goals || goals.length === 0) return "";

  return goals.map((g, idx) => `
    <span class="w3-tag w3-round w3-light-gray w3-small w3-margin-right goal-tag" 
          data-cpid="${cpId}" data-goalidx="${idx}" 
          data-half="${g.half}" data-minute="${g.minute || ''}">
      ⚽ ${halfLabel(g.half)}${g.minute ? " " + g.minute + "'" : ""}
      <span class="w3-hover-red" style="cursor:pointer;margin-left:4px" 
            onclick="removeGoalFromPlayer(${cpId}, ${idx})">✕</span>
    </span>
  `).join("");
}

// In-memory goals storage (per callup_player_id)
let playerGoalsMap = {};

function initPlayerGoalsMap() {
  playerGoalsMap = {};
  currentStatsPlayers.forEach(p => {
    const cpId = p.id;
    const existingPs = currentMatchStats?.player_stats?.find(ps => ps.callup_player_id === cpId);
    playerGoalsMap[cpId] = (existingPs?.goals || []).map(g => ({ half: g.half, minute: g.minute }));
  });
}

function addGoalToPlayer(cpId) {
  if (!playerGoalsMap[cpId]) playerGoalsMap[cpId] = [];

  // Show mini-modal to select half and minute
  const modalHtml = `
    <div id="goalModal" class="w3-modal" style="display:block">
      <div class="w3-modal-content w3-card-4 w3-round-large" style="max-width:300px">
        <header class="w3-container w3-purple w3-round-large" style="border-radius:16px 16px 0 0">
          <h4>⚽ Agregar Gol</h4>
        </header>
        <div class="w3-container w3-padding">
          <label class="w3-small">Tiempo</label>
          <select id="goalHalf" class="w3-select w3-border w3-round w3-margin-bottom">
            <option value="first">Primera Parte (1T)</option>
            <option value="second">Segunda Parte (2T)</option>
            <option value="extra_first">Tiempo Extra 1 (TE1)</option>
            <option value="extra_second">Tiempo Extra 2 (TE2)</option>
          </select>
          <label class="w3-small">Minuto (opcional)</label>
          <input id="goalMinute" type="number" min="1" max="120" class="w3-input w3-border w3-round" placeholder="Ej: 45">
        </div>
        <footer class="w3-container w3-padding">
          <button class="w3-button w3-white w3-border w3-round w3-small" onclick="closeGoalModal()">Cancelar</button>
          <button class="w3-button w3-purple w3-round w3-small w3-right" onclick="confirmAddGoal(${cpId})">Agregar</button>
        </footer>
      </div>
    </div>
  `;

  // Insert modal
  const modalDiv = document.createElement("div");
  modalDiv.innerHTML = modalHtml;
  document.body.appendChild(modalDiv.firstElementChild);
}

function closeGoalModal() {
  const modal = document.getElementById("goalModal");
  if (modal) modal.remove();
}

function confirmAddGoal(cpId) {
  const half = document.getElementById("goalHalf").value;
  const minuteVal = document.getElementById("goalMinute").value;
  const minute = minuteVal ? parseInt(minuteVal) : null;

  if (!playerGoalsMap[cpId]) playerGoalsMap[cpId] = [];
  playerGoalsMap[cpId].push({ half, minute });

  closeGoalModal();
  updateGoalsDisplay(cpId);
}

function removeGoalFromPlayer(cpId, goalIdx) {
  if (!playerGoalsMap[cpId]) return;
  playerGoalsMap[cpId].splice(goalIdx, 1);
  updateGoalsDisplay(cpId);
}

function updateGoalsDisplay(cpId) {
  const goals = playerGoalsMap[cpId] || [];
  const container = document.getElementById(`goalsContainer_${cpId}`);
  const countEl = document.getElementById(`goalsCount_${cpId}`);

  if (container) {
    container.innerHTML = renderPlayerGoals(cpId, goals);
  }
  if (countEl) {
    countEl.textContent = goals.length;
  }
}

function hideMatchStatsPanel() {
  const panel = document.getElementById("matchStatsPanel");
  if (panel) panel.remove();
  currentStatsCallupId = null;
  currentStatsPlayers = [];
  currentMatchStats = null;
  playerGoalsMap = {};
}

async function saveMatchStats() {
  const goalsAgainst = parseInt(document.getElementById("statsGoalsAgainst").value) || 0;
  const notes = document.getElementById("statsNotes").value.trim() || null;

  // Collect player stats
  const playerStats = [];

  currentStatsPlayers.forEach(p => {
    const cpId = p.id;
    const minutesInput = document.querySelector(`.stat-minutes[data-cpid="${cpId}"]`);
    const assistsInput = document.querySelector(`.stat-assists[data-cpid="${cpId}"]`);
    const yellowSelect = document.querySelector(`.stat-yellow[data-cpid="${cpId}"]`);
    const redCheckbox = document.querySelector(`.stat-red[data-cpid="${cpId}"]`);

    const minutes = parseInt(minutesInput?.value) || 0;
    const assists = parseInt(assistsInput?.value) || 0;
    const yellowCards = parseInt(yellowSelect?.value) || 0;
    const redCard = redCheckbox?.checked || false;
    const goals = playerGoalsMap[cpId] || [];

    playerStats.push({
      callup_player_id: cpId,
      minutes_played: minutes,
      assists: assists,
      yellow_cards: yellowCards,
      red_card: redCard,
      goals: goals
    });
  });

  const payload = {
    goals_against: goalsAgainst,
    notes: notes,
    player_stats: playerStats
  };

  const msgEl = document.getElementById("statsMsg");

  try {
    const res = await fetch(`${API_URL}/callups/${currentStatsCallupId}/stats/players`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al guardar");

    // Update current stats and re-render
    currentMatchStats = data;
    initPlayerGoalsMap(); // Reset from saved data
    renderMatchStatsPanel();

    if (msgEl) {
      msgEl.innerHTML = `<div class="w3-text-green">✅ Estadísticas guardadas correctamente.</div>`;
    }
  } catch (err) {
    if (msgEl) {
      msgEl.innerHTML = `<div class="w3-text-red">❌ ${err.message}</div>`;
    }
  }
}

// Initialize goals map when panel opens
const originalShowMatchStatsPanel = showMatchStatsPanel;
showMatchStatsPanel = async function(callupId) {
  await originalShowMatchStatsPanel(callupId);
  initPlayerGoalsMap();
};
