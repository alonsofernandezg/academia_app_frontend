(function () {
// =====================================================
// COACHES (ENTRENADORES)
// =====================================================
// Consume API base from global config.
var API_BASE = (() => {
  const defaultBase = "http://127.0.0.1:8000";
  const rawBase = String(window.API_BASE || defaultBase).trim().replace(/\/+$/, "");
  if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
    return `https://${rawBase.slice(7)}`;
  }
  return rawBase;
})();
window.API_BASE = API_BASE;
const roleName = window.role || localStorage.getItem("role") || "general";
const coachDashboardCommon = window.DashboardCommon || {};
const coachAuthHeaders = coachDashboardCommon.authHeaders || (() => {
  const token = localStorage.getItem("token");
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };
});
const coachSetStatusMessage = coachDashboardCommon.setStatusMessage || ((msgEl, text, className) => {
  if (!msgEl) return;
  msgEl.className = className || "w3-small w3-text-gray w3-center";
  msgEl.textContent = text;
});
const coachPaginateList = coachDashboardCommon.paginateList || ((items) => items);

function coachIconLabel(icon, text, tone = "ui-icon--brand", compact = false) {
  const compactClass = compact ? " ui-icon-label--compact" : "";
  return `<span class="ui-icon-label${compactClass}"><span class="ui-icon ${tone}" aria-hidden="true">${icon}</span><span>${text}</span></span>`;
}

function coachStatusLabel(isActive) {
  return isActive
    ? coachIconLabel("check_circle", "Activo", "ui-icon--success", true)
    : coachIconLabel("cancel", "Inactivo", "ui-icon--danger", true);
}

// --------------------------------------------------
// Funciones auxiliares
// --------------------------------------------------

// --------------------------------------------------
// CRUD: CARGAR COACHES
// --------------------------------------------------

async function loadCoaches() {
  const list = document.getElementById("coachesList");
  if (!list) return;

  list.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando entrenadores…</div>`;

  try {
    const res = await fetch(`${API_BASE}/coaches/`, { headers: coachAuthHeaders() });
    const coaches = await res.json();

    if (!res.ok) {
      throw new Error(coaches.detail || "No se pudieron cargar los entrenadores");
    }

    if (!coaches.length) {
      list.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay entrenadores registrados.</div>`;
      return;
    }

    const pageItems = coachPaginateList(coaches, "coaches", "coachesList", loadCoaches);

    list.innerHTML = pageItems
      .map((c) => {
        const status = c.is_active ? "Activo" : "Inactivo";
        const statusColor = c.is_active ? "w3-text-green" : "w3-text-red";

        return `
        <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom">
          <div class="w3-row">
            <div class="w3-col s12 m8">
              <b>${c.full_name}</b><br>
              <span class="w3-small w3-text-gray">
                ID: ${c.id_number || "—"} · Teléfono: ${c.phone || "—"}
              </span><br>
              <span class="w3-small ${statusColor}">
                ${status}
              </span>
              ${c.notes ? `<br><span class="w3-small w3-text-gray">${c.notes}</span>` : ""}
            </div>
            <div class="w3-col s12 m4 w3-right-align">
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                onclick='openEditCoach(${JSON.stringify(c)})'>
                ${coachIconLabel("edit_square", "Editar")}
              </button>
              <button
                class="w3-button w3-red w3-round-xxlarge w3-small w3-margin-left"
                onclick='deleteCoach(${c.id})'>
                ${coachIconLabel("delete", "Eliminar", "ui-icon--inverse")}
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (e) {
    list.innerHTML = `<div class="w3-center w3-text-red w3-small">${e.message}</div>`;
    console.error("Error cargando coaches:", e);
  }
}

// --------------------------------------------------
// CRUD: CARGAR USUARIOS COACH PARA SELECT
// --------------------------------------------------

async function loadCoachUsersSelect() {
  const sel = document.getElementById("coachUserId");
  if (!sel) return;

  try {
    // Obtener lista de usuarios con rol "coach"
    const res = await fetch(`${API_BASE}/admin/coaches`, { headers: coachAuthHeaders() });
    const coaches = await res.json();

    if (!res.ok) {
      throw new Error(coaches.detail || "No se pudieron cargar los entrenadores");
    }

    // Filtrar solo usuarios que no tengan registro de coach ya creado
    // (opcional: para simplicidad, mostramos todos los del rol coach)
    sel.innerHTML =
      `<option value="">Seleccione un entrenador…</option>` +
      coaches
        .map((u) => `<option value="${u.id}">${u.email}</option>`)
        .join("");
  } catch (e) {
    console.error("Error cargando usuarios coaches:", e);
    sel.innerHTML = `<option value="">Error cargando entrenadores</option>`;
  }
}

// --------------------------------------------------
// CRUD: CREAR/EDITAR COACH
// --------------------------------------------------

function openCreateCoach() {
  document.getElementById("coachEditId").value = "";
  document.getElementById("coachModalTitle").textContent = "Nuevo entrenador";
  document.getElementById("coachUserId").value = "";
  document.getElementById("coachUserId").disabled = false;
  document.getElementById("coachUserId").style.display = "";
  document.getElementById("coachUserIdHidden").value = "";
  document.getElementById("coachFullName").value = "";
  document.getElementById("coachIdNumber").value = "";
  document.getElementById("coachPhone").value = "";
  document.getElementById("coachNotes").value = "";
  document.getElementById("coachMsg").textContent = "";
  
  // Show admin select, hide hidden input
  const adminDiv = document.getElementById("coachUserIdAdmin");
  if (adminDiv) {
    adminDiv.style.display = "block";
    console.log("Admin form - showing user select");
  }
  
  document.getElementById("modalCreateCoach").style.display = "block";

  // Cargar opciones de usuarios coach
  loadCoachUsersSelect();
}

function closeCreateCoach() {
  document.getElementById("modalCreateCoach").style.display = "none";
}

function openEditCoach(coach) {
  document.getElementById("coachEditId").value = coach.id;
  document.getElementById("coachModalTitle").textContent = "Editar entrenador";
  document.getElementById("coachUserId").style.display = "";
  document.getElementById("coachUserId").value = coach.user_id;
  document.getElementById("coachUserId").disabled = true; // No cambiar usuario en edición
  document.getElementById("coachUserIdHidden").value = "";
  document.getElementById("coachFullName").value = coach.full_name;
  document.getElementById("coachIdNumber").value = coach.id_number || "";
  document.getElementById("coachPhone").value = coach.phone || "";
  document.getElementById("coachNotes").value = coach.notes || "";
  document.getElementById("coachMsg").textContent = "";
  document.getElementById("modalCreateCoach").style.display = "block";

  // No necesitamos cargar usuarios aquí (está deshabilitado)
}

async function saveCoach() {
  const coachId = document.getElementById("coachEditId").value;
  
  // Try to get user_id from either the select (admin) or hidden input (coach)
  const userIdSelect = document.getElementById("coachUserId").value;
  const userIdHidden = document.getElementById("coachUserIdHidden").value;
  const userId = userIdSelect || userIdHidden;
  
  const fullName = document.getElementById("coachFullName").value.trim();
  const idNumber = document.getElementById("coachIdNumber").value.trim();
  const phone = document.getElementById("coachPhone").value.trim();
  const notes = document.getElementById("coachNotes").value.trim();
  const msg = document.getElementById("coachMsg");

  msg.textContent = "";
  
  console.log("saveCoach called with:", { coachId, userId, fullName, idNumber, phone, notes });

  if (!fullName) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "El nombre completo es obligatorio.";
    console.error("fullName is empty");
    return;
  }

  if (!coachId && !userId) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = "Debe seleccionar un usuario (entrenador).";
    console.error("userId is missing (coachId:", coachId, "userId:", userId, ")");
    return;
  }

  try {
    coachSetStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
    let url = `${API_BASE}/coaches/`;
    let method = "POST";
    let body = {
      user_id: Number(userId),
      full_name: fullName,
      id_number: idNumber || null,
      phone: phone || null,
      notes: notes || null,
    };

    if (coachId) {
      // Editar
      url = `${API_BASE}/coaches/${coachId}`;
      method = "PUT";
      // En edición, quitamos user_id (no se puede cambiar)
      delete body.user_id;
    }

    console.log("Sending request:", { method, url, body });

    const res = await fetch(url, {
      method: method,
      headers: coachAuthHeaders(),
      body: JSON.stringify(body),
    });

    console.log("Response status:", res.status);
    
    const data = await res.json();
    
    console.log("Response data:", data);

    if (!res.ok) {
      throw new Error(data.detail || "No se pudo guardar el entrenador");
    }

    msg.className = "w3-small w3-text-green w3-center";
    msg.textContent = coachId
      ? "Entrenador actualizado correctamente."
      : "Entrenador creado correctamente.";

    // Recargar lista
    if (roleName === "admin") {
      await loadCoaches();
    } else {
      await loadCoachProfile();
      const btnCreate = document.getElementById("btnCoachCreate");
      const btnEdit = document.getElementById("btnCoachEdit");
      if (btnCreate) btnCreate.style.display = "none";
      if (btnEdit) btnEdit.style.display = "block";
    }

    // Cerrar modal después de 1 segundo
    setTimeout(closeCreateCoach, 1000);
  } catch (e) {
    msg.className = "w3-small w3-text-red w3-center";
    msg.textContent = e.message;
    console.error("Error guardando coach:", e);
  }
}

// --------------------------------------------------
// CRUD: ELIMINAR COACH
// --------------------------------------------------

async function deleteCoach(coachId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este entrenador?")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/coaches/${coachId}`, {
      method: "DELETE",
      headers: coachAuthHeaders(),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "No se pudo eliminar el entrenador");
    }

    // Recargar lista
    await loadCoaches();
  } catch (e) {
    alert("Error: " + e.message);
    console.error("Error eliminando coach:", e);
  }
}

// --------------------------------------------------
// Init
// --------------------------------------------------

// La carga inicial de coaches y perfil ahora la orquesta dashboard.js por módulo.

// =====================================================
// COACH PROFILE (for coaches to see/edit their own)
// =====================================================

/**
 * Load coach profile for the current user
 * Shows if they have a coach registration, or button to create one
 */
async function loadCoachProfile() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found in localStorage");
    return;
  }

  // Decode token to get user_id
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.user_id;  // Now includes user_id in token
    
    console.log("Token payload:", payload);
    console.log("user_id from token:", userId);
    
    if (!userId) {
      console.error("user_id not found in token. Token payload:", payload);
      document.getElementById("coachProfileInfo").innerHTML = 
        `<div class="w3-center w3-text-red w3-small">Error: user_id no encontrado en el token</div>`;
      return;
    }

    const infoDiv = document.getElementById("coachProfileInfo");
    if (!infoDiv) {
      console.error("coachProfileInfo div not found");
      return;
    }

    infoDiv.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando perfil…</div>`;

    try {
      // Try to get coach profile by user_id
      const url = `${API_BASE}/coaches/user/${userId}`;
      console.log("Fetching:", url);
      
      const res = await fetch(url, { 
        headers: coachAuthHeaders() 
      });

      console.log("Response status:", res.status);

      if (res.status === 404) {
        // No coach profile yet, show create button
        console.log("Coach profile not found (404) - showing create button");
        infoDiv.innerHTML = `
          <div class="w3-center w3-text-gray w3-small">
            <p>Aún no has registrado tu perfil como entrenador.</p>
            <p style="margin-top:10px">Completa el formulario para registrarte.</p>
          </div>
        `;
        document.getElementById("btnCoachCreate").style.display = "block";
        document.getElementById("btnCoachEdit").style.display = "none";
        window.currentCoachId = null;
        window.currentCoachProfile = null;
        window.currentCoachUserId = userId;
        return;
      }

      if (!res.ok) {
        throw new Error("Error cargando perfil");
      }

      const coach = await res.json();

      // Show coach profile
      const status = coachStatusLabel(coach.is_active);
      infoDiv.innerHTML = `
        <div class="w3-card w3-light-blue w3-round-large w3-padding">
          <p class="w3-margin-top-0"><b>${coach.full_name}</b> ${status}</p>
          <p class="w3-small w3-text-gray">
            <strong>ID:</strong> ${coach.id_number || "—"}<br>
            <strong>Teléfono:</strong> ${coach.phone || "—"}<br>
            <strong>Notas:</strong> ${coach.notes || "—"}<br>
            <strong>Creado:</strong> ${new Date(coach.created_at).toLocaleDateString("es-ES")}
          </p>
        </div>
      `;
      document.getElementById("btnCoachCreate").style.display = "none";
      document.getElementById("btnCoachEdit").style.display = "block";
      window.currentCoachId = coach.id;
      window.currentCoachProfile = coach;
      window.currentCoachUserId = userId;
    } catch (e) {
      infoDiv.innerHTML = `<div class="w3-center w3-text-red w3-small">Error: ${e.message}</div>`;
    }
  } catch (e) {
    console.error("Error decoding token:", e);
  }
}

/**
 * Open modal to create coach profile (for coaches)
 */
function openCreateCoachProfile() {
  const modal = document.getElementById("modalCreateCoach");
  if (!modal) {
    console.error("modalCreateCoach not found");
    return;
  }

  document.getElementById("coachModalTitle").textContent = "Registrar como Entrenador";
  document.getElementById("coachEditId").value = "";
  document.getElementById("coachFullName").value = "";
  document.getElementById("coachIdNumber").value = "";
  document.getElementById("coachPhone").value = "";
  document.getElementById("coachNotes").value = "";
  document.getElementById("coachMsg").textContent = "";

  // For coaches: auto-populate user_id from token and use hidden input
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.user_id;
      
      // Hide admin select, use hidden input instead
      const adminDiv = document.getElementById("coachUserIdAdmin");
      const userIdSelect = document.getElementById("coachUserId");
      const hiddenInput = document.getElementById("coachUserIdHidden");
      
      if (adminDiv && hiddenInput && userIdSelect) {
        adminDiv.style.display = "none";
        userIdSelect.disabled = false;
        userIdSelect.style.display = "none";
        userIdSelect.value = "";
        hiddenInput.value = userId;
        console.log("Coach form - user_id set to:", userId);
      }
    } catch (e) {
      console.error("Error extracting user_id from token", e);
    }
  } else {
    console.error("No token found when opening coach profile form");
  }

  modal.style.display = "block";
  console.log("Coach profile modal opened");
}

/**
 * Open modal to edit own coach profile (for coaches)
 */
function openEditCoachProfile() {
  const modal = document.getElementById("modalCreateCoach");
  if (!modal) return;

  const coach = window.currentCoachProfile;
  if (!coach || !coach.id) {
    console.error("No current coach profile loaded for edit");
    return;
  }

  document.getElementById("coachModalTitle").textContent = "Editar mi Perfil";
  document.getElementById("coachEditId").value = coach.id;
  document.getElementById("coachUserIdHidden").value = window.currentCoachUserId || coach.user_id || "";
  document.getElementById("coachFullName").value = coach.full_name || "";
  document.getElementById("coachIdNumber").value = coach.id_number || "";
  document.getElementById("coachPhone").value = coach.phone || "";
  document.getElementById("coachNotes").value = coach.notes || "";
  document.getElementById("coachMsg").textContent = "";

  // Hide user select for coaches
  const adminDiv = document.getElementById("coachUserIdAdmin");
  const userIdSelect = document.getElementById("coachUserId");
  if (adminDiv) {
    adminDiv.style.display = "none";
  }
  if (userIdSelect) {
    userIdSelect.disabled = false;
    userIdSelect.style.display = "none";
    userIdSelect.value = "";
  }

  modal.style.display = "block";
}

window.DashboardCoaches = {
  loadCoaches,
  loadCoachUsersSelect,
  openCreateCoach,
  closeCreateCoach,
  openEditCoach,
  saveCoach,
  deleteCoach,
  loadCoachProfile,
  openCreateCoachProfile,
  openEditCoachProfile,
};

})();

