(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para coach assignments.");
  }

  const {
    authHeaders,
    paginateList,
    setStatusMessage,
    showConfirmModal,
    showAlertModal,
  } = dashboardCommon;

  let editingAssignmentId = null;
  let changingAssignmentId = null;
  let changingAssignmentCoachId = null;

  function getApiUrl() {
    const rawBase = String(window.API_BASE || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  function requireGlobalFunction(name) {
    const fn = window[name];
    if (typeof fn !== "function") {
      throw new Error(`${name} no esta disponible.`);
    }
    return fn;
  }

  function cancelEditCoachAssignment() {
    editingAssignmentId = null;
    changingAssignmentId = null;
    changingAssignmentCoachId = null;
    const btn = document.getElementById("caCreateBtn");
    const cancelBtn = document.getElementById("caCancelBtn");
    if (btn) btn.textContent = "Guardar asignación";
    if (cancelBtn) cancelBtn.style.display = "none";
  }

  async function adminInitCoachAssignments() {
    const coachSel = document.getElementById("caCoach");
    const academySel = document.getElementById("caAcademy");
    const categorySel = document.getElementById("caCategory");
    const levelSel = document.getElementById("caLevel");
    const createBtn = document.getElementById("caCreateBtn");
    const cancelBtn = document.getElementById("caCancelBtn");

    if (!coachSel || !academySel || !categorySel || !levelSel || !createBtn) {
      return;
    }

    const loadCoachesSelect = requireGlobalFunction("loadCoachesSelect");
    const loadAcademiesSelect = requireGlobalFunction("loadAcademiesSelect");
    const loadCategoriesSelect = requireGlobalFunction("loadCategoriesSelect");
    const loadLevelsSelect = requireGlobalFunction("loadLevelsSelect");

    coachSel.onchange = () => {
      const coachId = coachSel.value;
      const caList = document.getElementById("caList");
      cancelEditCoachAssignment();
      if (coachId) {
        loadCoachAssignments(coachId);
      } else if (caList) {
        caList.innerHTML =
          `<div class="w3-text-gray w3-small">Seleccione un entrenador para ver sus asignaciones.</div>`;
      }
    };

    academySel.onchange = async () => {
      const academyId = academySel.value;
      await loadCategoriesSelect(academyId, "caCategory");
      await loadLevelsSelect("", "caLevel");
    };

    categorySel.onchange = async () => {
      const categoryId = categorySel.value;
      await loadLevelsSelect(categoryId, "caLevel");
    };

    createBtn.onclick = adminCreateCoachAssignment;
    if (cancelBtn) cancelBtn.onclick = cancelEditCoachAssignment;

    await loadCoachesSelect("caCoach");
    await loadAcademiesSelect("caAcademy");

    const caList = document.getElementById("caList");
    if (caList) {
      caList.innerHTML =
        `<div class="w3-text-gray w3-small">Seleccione un entrenador para ver sus asignaciones.</div>`;
    }
  }

  async function openEditCoachAssignment(assignment) {
    editingAssignmentId = assignment.id;
    changingAssignmentId = null;
    changingAssignmentCoachId = null;
    const btn = document.getElementById("caCreateBtn");
    const cancelBtn = document.getElementById("caCancelBtn");
    if (btn) btn.textContent = "Actualizar asignación";
    if (cancelBtn) cancelBtn.style.display = "inline-block";

    const coachSel = document.getElementById("caCoach");
    const academySel = document.getElementById("caAcademy");
    const categorySel = document.getElementById("caCategory");
    const levelSel = document.getElementById("caLevel");

    const loadCoachesSelect = requireGlobalFunction("loadCoachesSelect");
    const loadCategoriesSelect = requireGlobalFunction("loadCategoriesSelect");
    const loadLevelsSelect = requireGlobalFunction("loadLevelsSelect");

    await loadCoachesSelect("caCoach");
    if (coachSel) coachSel.value = assignment.coach_user_id ? String(assignment.coach_user_id) : "";
    if (academySel) academySel.value = String(assignment.academy_id || "");
    await loadCategoriesSelect(assignment.academy_id, "caCategory");
    if (categorySel) categorySel.value = assignment.category_id ? String(assignment.category_id) : "";
    await loadLevelsSelect(assignment.category_id, "caLevel");
    if (levelSel) levelSel.value = assignment.level_id ? String(assignment.level_id) : "";
  }

  async function openChangeCoachAssignment(assignment) {
    editingAssignmentId = null;
    changingAssignmentId = assignment.id;
    changingAssignmentCoachId = assignment.coach_user_id || null;
    const btn = document.getElementById("caCreateBtn");
    const cancelBtn = document.getElementById("caCancelBtn");
    if (btn) btn.textContent = "Cambiar entrenador";
    if (cancelBtn) cancelBtn.style.display = "inline-block";

    const coachSel = document.getElementById("caCoach");
    const academySel = document.getElementById("caAcademy");
    const categorySel = document.getElementById("caCategory");
    const levelSel = document.getElementById("caLevel");

    const loadCoachesSelect = requireGlobalFunction("loadCoachesSelect");
    const loadAcademiesSelect = requireGlobalFunction("loadAcademiesSelect");
    const loadCategoriesSelect = requireGlobalFunction("loadCategoriesSelect");
    const loadLevelsSelect = requireGlobalFunction("loadLevelsSelect");

    await loadCoachesSelect("caCoach");
    await loadAcademiesSelect("caAcademy");

    if (coachSel) coachSel.value = assignment.coach_user_id ? String(assignment.coach_user_id) : "";
    if (academySel) academySel.value = String(assignment.academy_id || "");
    await loadCategoriesSelect(assignment.academy_id, "caCategory");
    if (categorySel) categorySel.value = assignment.category_id ? String(assignment.category_id) : "";
    await loadLevelsSelect(assignment.category_id, "caLevel");
    if (levelSel) levelSel.value = assignment.level_id ? String(assignment.level_id) : "";
  }

  async function adminCreateCoachAssignment() {
    const coachSel = document.getElementById("caCoach");
    const academySel = document.getElementById("caAcademy");
    const categorySel = document.getElementById("caCategory");
    const levelSel = document.getElementById("caLevel");
    const msg = document.getElementById("caMsg");

    if (!coachSel || !academySel || !categorySel || !levelSel || !msg) return;

    msg.textContent = "";

    const coachUserId = coachSel.value ? Number(coachSel.value) : null;
    const academyId = academySel.value ? Number(academySel.value) : null;
    const categoryId = categorySel.value ? Number(categorySel.value) : null;
    const levelId = levelSel.value ? Number(levelSel.value) : null;

    if (!coachUserId || !academyId || !categoryId || !levelId) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Entrenador, academia, categoría y nivel son obligatorios.";
      return;
    }

    const isEdit = Boolean(editingAssignmentId);
    const isChange = Boolean(changingAssignmentId);

    if (isChange && changingAssignmentCoachId && coachUserId === changingAssignmentCoachId) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Seleccione un entrenador diferente para el cambio.";
      return;
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      if (isEdit) {
        const res = await fetch(`${getApiUrl()}/admin/coach-assignments/${editingAssignmentId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            academy_id: academyId,
            category_id: categoryId,
            level_id: levelId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "No se pudo guardar la asignación");
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = "Ajuste guardado correctamente.";
        cancelEditCoachAssignment();
        await loadCoachAssignments(coachUserId);
        return;
      }

      const createRes = await fetch(`${getApiUrl()}/admin/coach-assignments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          coach_user_id: coachUserId,
          academy_id: academyId,
          category_id: categoryId,
          level_id: levelId,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.detail || "No se pudo guardar la asignación");

      if (isChange && changingAssignmentId) {
        const closeRes = await fetch(
          `${getApiUrl()}/admin/coach-assignments/${changingAssignmentId}/close`,
          { method: "PATCH", headers: authHeaders() }
        );
        const closeData = await closeRes.json();
        if (!closeRes.ok) {
          throw new Error(closeData.detail || "No se pudo eliminar la asignación anterior");
        }
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = "Entrenador cambiado correctamente.";
      } else {
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = "Asignación creada correctamente.";
      }

      cancelEditCoachAssignment();
      await loadCoachAssignments(coachUserId);
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  async function loadCoachAssignments(coachId) {
    const box = document.getElementById("caList");
    if (!box) return;

    box.innerHTML = `<div class="w3-text-gray w3-small">Cargando asignaciones...</div>`;

    try {
      const res = await fetch(`${getApiUrl()}/admin/coach-assignments/coach/${coachId}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar las asignaciones");

      const activeAssignments = data.filter((assignment) => !assignment.end_date);

      if (!activeAssignments.length) {
        box.innerHTML =
          `<div class="w3-text-gray w3-small">Este entrenador no tiene asignaciones activas.</div>`;
        return;
      }

      const pageItems = paginateList(
        activeAssignments,
        "coachAssignments",
        "caList",
        () => loadCoachAssignments(coachId)
      );

      box.innerHTML = pageItems
        .map((assignment) => {
          const active = !assignment.end_date;
          const startStr = assignment.start_date || "";
          const endStr = assignment.end_date || "";
          const rangeText = startStr
            ? `${startStr}${endStr ? " → " + endStr : ""}`
            : "";

          return `
          <div class="w3-card w3-round-xxlarge w3-padding-small w3-margin-bottom">
            <div class="w3-row">
              <div class="w3-col s12 m8">
                <b>${assignment.academy_name || "Academia sin nombre"}</b><br>
                <span class="w3-small w3-text-gray">
                  Categoría: ${assignment.category_name || "-"} · Nivel: ${assignment.level_name || "-"}
                </span><br>
                <span class="w3-small ${active ? "w3-text-green" : "w3-text-gray"}">
                  ${active ? "Activa" : "Cerrada"}${rangeText ? " · " + rangeText : ""}
                </span>
              </div>
              <div class="w3-col s12 m4 w3-right-align">
                ${
                  active
                    ? `<button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                        onclick='window.DashboardCoachAssignments.openEditCoachAssignment(${JSON.stringify(assignment)})'>
                        Editar
                      </button>
                      <button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                        onclick='window.DashboardCoachAssignments.openChangeCoachAssignment(${JSON.stringify(assignment)})'>
                        Cambiar entrenador
                      </button>
                      <button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                        onclick="window.DashboardCoachAssignments.closeCoachAssignment(${assignment.id}, ${coachId})">
                        Eliminar
                      </button>`
                    : `<button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                        onclick="window.DashboardCoachAssignments.reopenCoachAssignment(${assignment.id}, ${coachId})">
                        Reabrir
                      </button>
                      <button
                        class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                        onclick='window.DashboardCoachAssignments.duplicateCoachAssignment(${JSON.stringify(assignment)}, ${coachId})'>
                        Duplicar
                      </button>`
                }
              </div>
            </div>
          </div>
        `;
        })
        .join("");
    } catch (error) {
      box.innerHTML = `<div class="w3-text-red w3-small">${error.message}</div>`;
    }
  }

  async function closeCoachAssignment(assignmentId, coachId) {
    const ok = await showConfirmModal("¿Eliminar esta asignación? Se mantiene el histórico.");
    if (!ok) return;

    try {
      const res = await fetch(`${getApiUrl()}/admin/coach-assignments/${assignmentId}/close`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo eliminar la asignación");

      cancelEditCoachAssignment();
      await loadCoachAssignments(coachId);
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function reopenCoachAssignment(assignmentId, coachId) {
    const ok = await showConfirmModal("¿Reabrir esta asignación?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/admin/coach-assignments/${assignmentId}/reopen`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo reabrir la asignación");
      await loadCoachAssignments(coachId);
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function duplicateCoachAssignment(assignment, coachId) {
    const ok = await showConfirmModal("¿Duplicar esta asignación?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/admin/coach-assignments`, {
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
      if (!res.ok) throw new Error(data.detail || "No se pudo duplicar la asignación");
      await loadCoachAssignments(coachId);
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  window.DashboardCoachAssignments = {
    adminInitCoachAssignments,
    cancelEditCoachAssignment,
    openEditCoachAssignment,
    openChangeCoachAssignment,
    adminCreateCoachAssignment,
    loadCoachAssignments,
    closeCoachAssignment,
    reopenCoachAssignment,
    duplicateCoachAssignment,
  };
})();