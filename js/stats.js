// ══════════════════════════════════════════════
// CONFIG & STATE
// ══════════════════════════════════════════════
const API_URL = (() => {
  const defaultBase = "http://127.0.0.1:8000";
  const rawBase = String(window.API_BASE || defaultBase).trim().replace(/\/+$/, "");
  if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
    return `https://${rawBase.slice(7)}`;
  }
  return rawBase;
})();
window.API_BASE = API_URL;
let token = localStorage.getItem("token");

// Team tab state
let teamPeriod = "all";
let teamVenue = "all";
let teamLevelId = null;

// Player tab state
let playerPeriod = "all";
let playerVenue = "all";
let currentAthleteId = null;

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener("load", async () => {
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const email = payload.sub || "";
    const role = payload.role || "usuario";
    document.getElementById("userBadge").innerHTML =
      `<span class="w3-tag w3-white w3-round-xxlarge w3-padding-small" style="color:#1565c0">
        ${email} · rol: <b>${role}</b>
      </span>`;
  } catch (e) {}

  // Load teams dropdown + initial team stats in parallel
  await Promise.all([
    loadTeamDropdown(),
    loadPlayerDropdown(),
  ]);

  await loadTeamStats();
  document.getElementById("loadingSpinner").classList.add("w3-hide");
  document.getElementById("mainContent").classList.remove("w3-hide");
});

// ══════════════════════════════════════════════
// TAB SWITCHER
// ══════════════════════════════════════════════
function switchTab(tab) {
  document.getElementById("tabTeam").classList.toggle("w3-hide", tab !== "team");
  document.getElementById("tabPlayer").classList.toggle("w3-hide", tab !== "player");
  document.getElementById("tabTeamBtn").classList.toggle("active", tab === "team");
  document.getElementById("tabPlayerBtn").classList.toggle("active", tab === "player");
}

// ══════════════════════════════════════════════
// TEAM TAB
// ══════════════════════════════════════════════
async function loadTeamDropdown() {
  try {
    const res = await fetch(`${API_URL}/stats/team?period=all&venue=all`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const sel = document.getElementById("teamLevelSelect");
    sel.innerHTML = '<option value="">Todos los equipos</option>';
    (data.available_teams || []).forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.level_id;
      opt.textContent = `${t.category_name} / ${t.level_name}`;
      sel.appendChild(opt);
    });
  } catch (e) {}
}

function onTeamLevelChange() {
  const v = document.getElementById("teamLevelSelect").value;
  teamLevelId = v ? parseInt(v) : null;
  loadTeamStats();
}

function setTeamPeriod(p) {
  teamPeriod = p;
  ["all", "year", "quarter", "month"].forEach(k =>
    document.getElementById(`tp-${k}`).classList.toggle("active-period", k === p)
  );
  loadTeamStats();
}

function setTeamVenue(v) {
  teamVenue = v;
  ["all", "local", "visitante"].forEach(k =>
    document.getElementById(`tv-${k}`).classList.toggle("active-venue", k === v)
  );
  loadTeamStats();
}

async function loadTeamStats() {
  document.getElementById("teamLoading").classList.remove("w3-hide");
  document.getElementById("teamData").classList.add("w3-hide");
  document.getElementById("teamEmpty").classList.add("w3-hide");

  let url = `${API_URL}/stats/team?period=${teamPeriod}&venue=${teamVenue}`;
  if (teamLevelId) url += `&level_id=${teamLevelId}`;

  try {
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    document.getElementById("teamLoading").classList.add("w3-hide");

    if (!data.team_stats || data.team_stats.length === 0) {
      document.getElementById("teamEmpty").classList.remove("w3-hide");
      return;
    }

    renderTeamSummaryCards(data.team_stats);
    renderTeamTable(data.team_stats);
    renderGoalsByPhase(data.goals_by_phase, "teamGoalsPhase");
    document.getElementById("teamData").classList.remove("w3-hide");
  } catch (err) {
    document.getElementById("teamLoading").innerHTML =
      `<div class="w3-text-red w3-small">${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════
// PLAYER TAB
// ══════════════════════════════════════════════
async function loadPlayerDropdown() {
  try {
    const res = await fetch(`${API_URL}/stats/players`, { headers: authHeaders() });
    if (!res.ok) return;
    const players = await res.json();
    const sel = document.getElementById("playerSelect");
    sel.innerHTML = '<option value="">— Selecciona un jugador —</option>';
    players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.athlete_id;
      opt.textContent = `${p.name}  (${p.team})`;
      sel.appendChild(opt);
    });
    // If only one player (parent/athlete), auto-select
    if (players.length === 1) {
      sel.value = players[0].athlete_id;
      onPlayerChange();
    }
  } catch (e) {}
}

function onPlayerChange() {
  const v = document.getElementById("playerSelect").value;
  currentAthleteId = v ? parseInt(v) : null;
  if (!currentAthleteId) {
    document.getElementById("playerPrompt").classList.remove("w3-hide");
    document.getElementById("playerData").classList.add("w3-hide");
    document.getElementById("playerEmpty").classList.add("w3-hide");
    return;
  }
  loadPlayerStats();
}

function setPlayerPeriod(p) {
  playerPeriod = p;
  ["all", "year", "quarter", "month"].forEach(k =>
    document.getElementById(`pp-${k}`).classList.toggle("active-period", k === p)
  );
  if (currentAthleteId) loadPlayerStats();
}

function setPlayerVenue(v) {
  playerVenue = v;
  ["all", "local", "visitante"].forEach(k =>
    document.getElementById(`pv-${k}`).classList.toggle("active-venue", k === v)
  );
  if (currentAthleteId) loadPlayerStats();
}

async function loadPlayerStats() {
  document.getElementById("playerPrompt").classList.add("w3-hide");
  document.getElementById("playerLoading").classList.remove("w3-hide");
  document.getElementById("playerData").classList.add("w3-hide");
  document.getElementById("playerEmpty").classList.add("w3-hide");

  const url = `${API_URL}/stats/player?athlete_id=${currentAthleteId}&period=${playerPeriod}&venue=${playerVenue}`;

  try {
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    document.getElementById("playerLoading").classList.add("w3-hide");

    if (data.summary.matches === 0) {
      document.getElementById("playerEmpty").classList.remove("w3-hide");
      return;
    }

    document.getElementById("playerNameHeader").textContent = `👤 ${data.name}`;
    renderPlayerSummary(data.summary);
    renderMatchHistory(data.match_history);
    document.getElementById("playerData").classList.remove("w3-hide");
  } catch (err) {
    document.getElementById("playerLoading").innerHTML =
      `<div class="w3-text-red w3-small">${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════
// RENDER: TEAM SUMMARY CARDS
// ══════════════════════════════════════════════
function renderTeamSummaryCards(teams) {
  let mp = 0;
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  teams.forEach(t => {
    mp += t.matches_played;
    w += t.won;
    d += t.drawn;
    l += t.lost;
    gf += t.goals_for;
    ga += t.goals_against;
  });
  const gd = gf - ga;
  document.getElementById("teamSummaryCards").innerHTML = `
    <div class="scard"><div class="scard-val">${mp}</div><div class="scard-lbl">Partidos</div></div>
    <div class="scard green"><div class="scard-val">${w}</div><div class="scard-lbl">Victorias</div></div>
    <div class="scard gray"><div class="scard-val">${d}</div><div class="scard-lbl">Empates</div></div>
    <div class="scard orange"><div class="scard-val">${l}</div><div class="scard-lbl">Derrotas</div></div>
    <div class="scard blue"><div class="scard-val">${gf}</div><div class="scard-lbl">Goles a favor</div></div>
    <div class="scard"><div class="scard-val">${ga}</div><div class="scard-lbl">Goles en contra</div></div>
    <div class="scard ${gd >= 0 ? "green" : "orange"}"><div class="scard-val">${gd > 0 ? "+" : ""}${gd}</div><div class="scard-lbl">Diferencia</div></div>
  `;
}

// ══════════════════════════════════════════════
// RENDER: TEAM TABLE
// ══════════════════════════════════════════════
function renderTeamTable(teams) {
  if (!teams.length) {
    document.getElementById("teamTableContent").innerHTML = `<div class="w3-center w3-text-gray w3-small w3-padding">Sin datos.</div>`;
    return;
  }
  let html = `
    <div class="team-row hdr">
      <div>Equipo</div><div>PJ</div><div>G</div><div>E</div><div>P</div>
      <div>GF</div><div>GC</div><div>Dif</div>
    </div>`;
  teams.forEach(t => {
    const gd = t.goals_for - t.goals_against;
    html += `
      <div class="team-row">
        <div><b>${t.category_name}</b><br><small style="color:#666">${t.level_name}</small></div>
        <div>${t.matches_played}</div>
        <div style="color:#2e7d32;font-weight:600">${t.won}</div>
        <div style="color:#f57f17">${t.drawn}</div>
        <div style="color:#c62828">${t.lost}</div>
        <div>${t.goals_for}</div>
        <div>${t.goals_against}</div>
        <div style="font-weight:600;color:${gd > 0 ? "#2e7d32" : gd < 0 ? "#c62828" : "#555"}">${gd > 0 ? "+" : ""}${gd}</div>
      </div>`;
  });
  document.getElementById("teamTableContent").innerHTML = html;
}

// ══════════════════════════════════════════════
// RENDER: GOALS BY PHASE
// ══════════════════════════════════════════════
function renderGoalsByPhase(g, containerId) {
  const container = document.getElementById(containerId);
  if (!g) {
    container.innerHTML = "";
    return;
  }
  const total = (g.first || 0) + (g.second || 0) + (g.extra_first || 0) + (g.extra_second || 0);
  const extraTotal = (g.extra_first || 0) + (g.extra_second || 0);
  const bar = (val) => `<div style="background:#e0e0e0;border-radius:4px;height:8px;margin-top:6px">
    <div style="background:currentColor;width:${total ? Math.round(val / total * 100) : 0}%;height:100%;border-radius:4px"></div></div>`;

  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
      <div class="phase-card first" style="flex:1;min-width:100px">
        <div class="pval">${g.first || 0}</div><div class="plbl">1er Tiempo</div>${bar(g.first || 0)}
      </div>
      <div class="phase-card second" style="flex:1;min-width:100px">
        <div class="pval">${g.second || 0}</div><div class="plbl">2do Tiempo</div>${bar(g.second || 0)}
      </div>
      ${extraTotal > 0 ? `
      <div class="phase-card extra" style="flex:1;min-width:100px">
        <div class="pval">${g.extra_first || 0}</div><div class="plbl">Prórroga 1</div>${bar(g.extra_first || 0)}
      </div>
      <div class="phase-card extra" style="flex:1;min-width:100px">
        <div class="pval">${g.extra_second || 0}</div><div class="plbl">Prórroga 2</div>${bar(g.extra_second || 0)}
      </div>` : ""}
    </div>
    <div style="text-align:center;font-size:12px;color:#888">Total: <b>${total}</b> goles</div>`;
}

// ══════════════════════════════════════════════
// RENDER: PLAYER SUMMARY
// ══════════════════════════════════════════════
function renderPlayerSummary(s) {
  document.getElementById("playerSummaryCards").innerHTML = `
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%">
      <div class="scard blue"><div class="scard-val">${s.matches}</div><div class="scard-lbl">Partidos</div></div>
      <div class="scard green"><div class="scard-val">${s.goals}</div><div class="scard-lbl">⚽ Goles</div></div>
      <div class="scard"><div class="scard-val">${s.assists}</div><div class="scard-lbl">🅰️ Asistencias</div></div>
      <div class="scard gray"><div class="scard-val">${fmtMin(s.minutes)}</div><div class="scard-lbl">⏱️ Minutos</div></div>
      <div class="scard" style="background:linear-gradient(135deg,#f6d365,#fda085)">
        <div class="scard-val">${s.yellow_cards}</div><div class="scard-lbl">🟨 Amarillas</div>
      </div>
      <div class="scard orange"><div class="scard-val">${s.red_cards}</div><div class="scard-lbl">🟥 Rojas</div></div>
    </div>`;
}

// ══════════════════════════════════════════════
// RENDER: MATCH HISTORY
// ══════════════════════════════════════════════
function renderMatchHistory(history) {
  if (!history || history.length === 0) {
    document.getElementById("playerHistoryContent").innerHTML =
      `<div class="w3-center w3-text-gray w3-small w3-padding">Sin partidos registrados.</div>`;
    return;
  }
  let html = `
    <div class="mh-row hdr">
      <div>Fecha</div><div>Partido / Equipo</div><div>Localía</div>
      <div>⚽</div><div>🅰️</div><div>⏱️</div><div>🟨</div><div>🟥</div>
    </div>`;
  history.forEach(m => {
    const dateStr = m.date ? new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    html += `
      <div class="mh-row">
        <div style="font-size:0.78em;color:#555">${dateStr}</div>
        <div>
          <b style="font-size:0.88em">${m.title || "Partido"}</b>
          ${m.opponent ? `<span style="font-size:0.78em;color:#777"> vs ${m.opponent}</span>` : ""}
          <br><span style="font-size:0.74em;color:#999">${m.team}</span>
        </div>
        <div><span class="badge ${m.venue === "visitante" ? "visitante" : "local"}">${m.venue === "visitante" ? "Visita" : "Local"}</span></div>
        <div style="font-weight:600;color:#1976d2">${m.goals}</div>
        <div>${m.assists}</div>
        <div style="font-size:0.82em">${fmtMin(m.minutes)}</div>
        <div>${m.yellow_cards > 0 ? "🟨" : "-"}</div>
        <div>${m.red_card ? "🟥" : "-"}</div>
      </div>`;
  });
  document.getElementById("playerHistoryContent").innerHTML = html;
}

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
function fmtMin(min) {
  if (!min) return "0'";
  if (min < 60) return `${min}'`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}'` : ""}`;
}
