(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible.");
  }

  const {
    authHeaders,
    resolveFileUrl,
    formatAnnouncementTarget,
    setStatusMessage,
    paginateList,
    showConfirmModal,
    showAlertModal,
  } = dashboardCommon;

  let announcementsCache = [];
  let editingAnnouncementId = null;

  function getApiUrl() {
    const rawBase = String(window.API_BASE || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getRoleName() {
    return window.role || localStorage.getItem("role") || "general";
  }

  function getUserId() {
    try {
      const token = getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.user_id;
    } catch {
      return null;
    }
  }

  async function initAdminAnnouncements() {
    if (typeof window.loadAcademiesSelect === "function") {
      await window.loadAcademiesSelect("adminAnnAcademy");
    }
    if (typeof window.loadCoachesSelect === "function") {
      await window.loadCoachesSelect("adminAnnCoach");
    }

    const scopeSel = document.getElementById("adminAnnScope");
    const academySel = document.getElementById("adminAnnAcademy");
    const categorySel = document.getElementById("adminAnnCategory");
    const coachSel = document.getElementById("adminAnnCoach");

    if (scopeSel) scopeSel.addEventListener("change", () => updateAnnouncementScope("admin"));
    if (academySel) {
      academySel.addEventListener("change", async () => {
        if (typeof window.loadCategoriesSelect === "function") {
          await window.loadCategoriesSelect(academySel.value, "adminAnnCategory");
        }
        if (typeof window.loadLevelsSelect === "function") {
          await window.loadLevelsSelect("", "adminAnnLevel");
        }
      });
    }
    if (categorySel) {
      categorySel.addEventListener("change", async () => {
        if (typeof window.loadLevelsSelect === "function") {
          await window.loadLevelsSelect(categorySel.value, "adminAnnLevel");
        }
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
      if (roleKey === "coach" && levelWrap) {
        levelWrap.classList.add("w3-hide");
      }
    }
  }

  async function loadCoachAnnouncementLevels(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">Seleccione un nivel...</option>`;

    try {
      const response = await fetch(`${getApiUrl()}/admin/coach-assignments/my/active`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");

      const options = data
        .map(
          (assignment) =>
            `<option value="${assignment.level_id}">${assignment.academy_name} / ${assignment.category_name} / ${assignment.level_name}</option>`
        )
        .join("");
      select.innerHTML = `<option value="">Seleccione un nivel...</option>` + options;
    } catch {
      select.innerHTML = `<option value="">Error cargando niveles</option>`;
    }
  }

  async function loadAnnouncementTeamLevelsForCoach(coachId, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">Seleccione un nivel...</option>`;

    if (!coachId) return;
    try {
      const response = await fetch(
        `${getApiUrl()}/admin/coach-assignments/coach/${coachId}?active_only=true`,
        { headers: authHeaders() }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");
      const options = data
        .map(
          (assignment) =>
            `<option value="${assignment.level_id}">${assignment.academy_name} / ${assignment.category_name} / ${assignment.level_name}</option>`
        )
        .join("");
      select.innerHTML = `<option value="">Seleccione un nivel...</option>` + options;
    } catch {
      select.innerHTML = `<option value="">Error cargando niveles</option>`;
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
      target.coach_user_id =
        roleKey === "admin"
          ? Number(document.getElementById(`${roleKey}AnnCoach`)?.value || "")
          : getUserId();
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
      const formData = new FormData();
      formData.append("title", title);
      formData.append("message", message);
      formData.append("priority", priority);
      if (!editingAnnouncementId) {
        formData.append("targets", JSON.stringify([target]));
      }
      files.forEach((file) => formData.append("files", file));

      const url = editingAnnouncementId
        ? `${getApiUrl()}/announcements/${editingAnnouncementId}`
        : `${getApiUrl()}/announcements`;
      const method = editingAnnouncementId ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { Authorization: "Bearer " + getToken() },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo enviar el aviso");

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
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  function openEditAnnouncement(roleKey, announcement) {
    editingAnnouncementId = announcement.id;
    document.getElementById(`${roleKey}AnnTitle`).value = announcement.title || "";
    document.getElementById(`${roleKey}AnnMessage`).value = announcement.message || "";
    document.getElementById(`${roleKey}AnnPriority`).value = announcement.priority || "normal";
    const msg = document.getElementById(`${roleKey}AnnMsg`);
    if (msg) msg.textContent = "";
  }

  async function retireAnnouncement(roleKey, id) {
    const ok = await showConfirmModal("\u00bfRetirar este aviso?");
    if (!ok) return;
    try {
      const response = await fetch(`${getApiUrl()}/announcements/${id}/retire`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo retirar el aviso");
      await loadAnnouncements(roleKey);
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function deleteAnnouncementAttachment(attachmentId, roleKey) {
    const ok = await showConfirmModal("\u00bfEliminar este adjunto?");
    if (!ok) return;
    try {
      const response = await fetch(`${getApiUrl()}/announcements/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudo eliminar el adjunto");
      await loadAnnouncements(roleKey);
    } catch (error) {
      showAlertModal(error.message);
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
      const response = await fetch(`${getApiUrl()}/announcements/my`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudieron cargar los avisos");
      announcementsCache = data;
      renderAnnouncements(listId);
    } catch (error) {
      box.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
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
    const currentRole = getRoleName();

    const pageItems = paginateList(
      announcementsCache,
      `announcements_${listId}`,
      listId,
      () => loadAnnouncements(roleKey)
    );

    box.innerHTML = pageItems
      .map((announcement) => {
        const targets = (announcement.targets || []).map(formatAnnouncementTarget).join(" | ");
        const canEdit =
          currentRole === "admin" ||
          (currentRole === "coach" && announcement.created_by_user_id === getUserId());
        const attachments = (announcement.attachments || [])
          .map((attachment) => {
            const removeBtn = canEdit
              ? `<button
                  class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick='deleteAnnouncementAttachment(${attachment.id}, "${roleKey}")'>
                  Eliminar
                </button>`
              : "";
            return `<span class="w3-margin-right">
              <a href="${resolveFileUrl(attachment.file_url)}" target="_blank">${attachment.file_name}</a>${removeBtn}
            </span>`;
          })
          .join(" ");
        const attachmentBlock = attachments
          ? `<div class="w3-small w3-text-gray">Adjuntos: ${attachments}</div>`
          : "";
        const statusTag = announcement.is_active === false
          ? `<span class="w3-tag w3-round-xxlarge w3-light-gray w3-tiny w3-margin-left">Retirado</span>`
          : "";
        const actions =
          roleKey !== "general" && canEdit
            ? `<div class="w3-margin-top">
                <button
                  class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
                  onclick='openEditAnnouncement("${roleKey}", ${JSON.stringify(announcement)})'>
                  Editar
                </button>
                <button
                  class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick='retireAnnouncement("${roleKey}", ${announcement.id})'>
                  Retirar
                </button>
              </div>`
            : "";
        const priorityBadge = announcement.priority === "high"
          ? `<span class="w3-tag w3-round-xxlarge w3-red w3-tiny" style="font-size:10px;">Alta</span>`
          : announcement.priority === "low"
          ? `<span class="w3-tag w3-round-xxlarge w3-light-gray w3-tiny" style="font-size:10px;">Baja</span>`
          : `<span class="w3-tag w3-round-xxlarge w3-blue w3-tiny" style="font-size:10px;">Media</span>`;

        return `
        <div class="w3-card-2 w3-round-large w3-margin-bottom" style="overflow:hidden;">
          <div style="border-left:4px solid ${announcement.priority === "high" ? "#EF4444" : announcement.priority === "low" ? "#9CA3AF" : "#3B82F6"}; padding:16px 20px;">
            <div class="w3-row">
              <div class="w3-col s12 m8">
                <div style="font-weight:600; font-size:15px; color:#1f2937;">${announcement.title}</div>
                <div style="margin-top:4px;">
                  ${priorityBadge}
                  ${statusTag}
                  <span class="w3-small w3-text-gray" style="margin-left:6px;">${targets || ""}</span>
                </div>
              </div>
              <div class="w3-col s12 m4 w3-right-align w3-small w3-text-gray" style="padding-top:4px;">
                ${announcement.created_at ? new Date(announcement.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" }) : ""}
              </div>
            </div>
            <div style="margin-top:12px; font-size:14px; line-height:1.6; color:#374151; text-align:justify; white-space:pre-line;">${announcement.message}</div>
            ${attachmentBlock}
            ${actions}
          </div>
        </div>
      `;
      })
      .join("");
  }

  window.DashboardCommunications = {
    initAdminAnnouncements,
    initCoachAnnouncements,
    updateAnnouncementScope,
    loadCoachAnnouncementLevels,
    loadAnnouncementTeamLevelsForCoach,
    createAnnouncement,
    openEditAnnouncement,
    retireAnnouncement,
    deleteAnnouncementAttachment,
    loadAnnouncements,
  };
})();
