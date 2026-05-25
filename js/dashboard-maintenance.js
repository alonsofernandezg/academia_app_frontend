(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para maintenance.");
  }

  const {
    authHeaders,
    paginateList,
    setStatusMessage,
    showConfirmModal,
    showAlertModal,
  } = dashboardCommon;

  let editingAcademyId = null;
  let editingCategoryId = null;
  let editingLevelId = null;

  function getApiUrl() {
    const rawBase = String(window.API_BASE || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  async function refreshSharedAcademySelects() {
    if (typeof window.loadAcademiesSelect !== "function") return;
    await window.loadAcademiesSelect("aAcademy");
    await window.loadAcademiesSelect("eAcademy");
    await window.loadAcademiesSelect("caAcademy");
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
    if (btn) btn.textContent = "Guardar categoria";
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
    if (btn) btn.textContent = "Actualizar categoria";
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

  async function adminReloadAcademiesUI() {
    const list = document.getElementById("admAcadList");
    const selCatAcad = document.getElementById("admCatAcademy");
    const msg = document.getElementById("admAcadMsg");

    if (list) {
      list.innerHTML = `<div class="w3-text-gray w3-small">Cargando academias...</div>`;
    }

    try {
      const [resAll, resActive] = await Promise.all([
        fetch(`${getApiUrl()}/academies/admin`, { headers: authHeaders() }),
        fetch(`${getApiUrl()}/academies/`, { headers: authHeaders() }),
      ]);
      const academies = await resAll.json();
      const activeAcademies = await resActive.json();
      if (!resAll.ok) throw new Error(academies.detail || "No se pudieron cargar las academias");
      if (!resActive.ok) throw new Error(activeAcademies.detail || "No se pudieron cargar las academias");

      if (list) {
        if (!academies.length) {
          list.innerHTML = `<div class="w3-text-gray w3-small">No hay academias registradas.</div>`;
        } else {
          const pageItems = paginateList(
            academies,
            "adminAcademies",
            "admAcadList",
            adminReloadAcademiesUI
          );

          list.innerHTML = pageItems
            .map((academy) => {
              const statusText = academy.is_active ? "Activa" : "Inactiva";
              const statusClass = academy.is_active ? "w3-text-green" : "w3-text-red";
              const toggleText = academy.is_active ? "Inactivar" : "Activar";
              const deleteBtn = !academy.is_active
                ? `<button
                    class="w3-button w3-red w3-round-xxlarge w3-tiny w3-margin-left"
                    onclick="window.DashboardMaintenance.deleteAcademy(${academy.id})">
                    Eliminar
                  </button>`
                : "";
              return `
            <div class="w3-padding-small w3-border-bottom">
              <div>
                <span class="w3-tag w3-round-xxlarge w3-light-gray">
                  ${academy.code ? `<b>${academy.code}</b> - ` : ""}${academy.name}
                </span>
                <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span>
              </div>
              <div class="w3-small w3-margin-top">
                <button
                  class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
                  onclick='window.DashboardMaintenance.openEditAcademy(${JSON.stringify(academy)})'>
                  Editar
                </button>
                <button
                  class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="window.DashboardMaintenance.toggleAcademyStatus(${academy.id}, ${!academy.is_active})">
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

      if (selCatAcad) {
        selCatAcad.innerHTML =
          `<option value="">Seleccione una academia...</option>` +
          activeAcademies
            .map(
              (academy) =>
                `<option value="${academy.id}">${academy.code ? `${academy.code} - ` : ""}${academy.name}</option>`
            )
            .join("");
      }

      await refreshSharedAcademySelects();

      if (msg) {
        msg.className = "w3-small w3-center w3-text-gray";
        msg.textContent = "";
      }
    } catch (error) {
      console.error(error);
      if (list) {
        list.innerHTML = `<div class="w3-text-red w3-small">${error.message}</div>`;
      }
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
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
      const url = isEdit
        ? `${getApiUrl()}/academies/${editingAcademyId}`
        : `${getApiUrl()}/academies/`;
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
        ? "Academia actualizada correctamente."
        : "Academia creada correctamente.";

      cancelEditAcademy();
      await adminReloadAcademiesUI();
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  async function toggleAcademyStatus(academyId, isActive) {
    try {
      const res = await fetch(`${getApiUrl()}/academies/${academyId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el estado");
      await adminReloadAcademiesUI();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function deleteAcademy(academyId) {
    const ok = await showConfirmModal("\u00bfEliminar esta academia?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/academies/${academyId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo eliminar la academia");
      await adminReloadAcademiesUI();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function adminReloadCategoriesUI() {
    const selCatAcad = document.getElementById("admCatAcademy");
    const list = document.getElementById("admCatList");
    const selLvlCat = document.getElementById("admLvlCategory");
    const msg = document.getElementById("admCatMsg");

    if (!list) return;
    list.innerHTML = `<div class="w3-text-gray w3-small">Cargando categorias...</div>`;

    const academyId = selCatAcad ? selCatAcad.value : "";

    if (!academyId) {
      list.innerHTML = `<div class="w3-text-gray w3-small">
        Selecciona una academia para ver sus categorias.
      </div>`;
      if (selLvlCat) {
        selLvlCat.innerHTML = `<option value="">Seleccione una categoria...</option>`;
      }
      return;
    }

    try {
      const resAll = await fetch(
        `${getApiUrl()}/categories/?academy_id=${academyId}&include_inactive=true`,
        { headers: authHeaders() }
      );
      const categories = await resAll.json();
      if (!resAll.ok) {
        throw new Error(categories.detail || "No se pudieron cargar las categorias");
      }

      if (!categories.length) {
        list.innerHTML = `<div class="w3-text-gray w3-small">No hay categorias para esta academia.</div>`;
      } else {
        const pageItems = paginateList(
          categories,
          "adminCategories",
          "admCatList",
          adminReloadCategoriesUI
        );

        list.innerHTML = pageItems
          .map((category) => {
            const statusText = category.is_active ? "Activa" : "Inactiva";
            const statusClass = category.is_active ? "w3-text-green" : "w3-text-red";
            const toggleText = category.is_active ? "Inactivar" : "Activar";
            const deleteBtn = !category.is_active
              ? `<button
                  class="w3-button w3-red w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="window.DashboardMaintenance.deleteCategory(${category.id})">
                  Eliminar
                </button>`
              : "";
            return `
          <div class="w3-padding-small w3-border-bottom">
            <div>
              <span class="w3-tag w3-round-xxlarge w3-pale-blue">
                ${category.name}
              </span>
              <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span>
            </div>
            <div class="w3-small w3-text-gray">${category.description || ""}</div>
            <div class="w3-small w3-margin-top">
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
                onclick='window.DashboardMaintenance.openEditCategory(${JSON.stringify(category)})'>
                Editar
              </button>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="window.DashboardMaintenance.toggleCategoryStatus(${category.id}, ${!category.is_active})">
                ${toggleText}
              </button>
              ${deleteBtn}
            </div>
          </div>
        `;
          })
          .join("");
      }

      if (selLvlCat) {
        selLvlCat.innerHTML =
          `<option value="">Seleccione una categoria...</option>` +
          categories
            .map((category) => {
              const suffix = category.is_active ? "" : " (Inactiva)";
              return `<option value="${category.id}">${category.name}${suffix}</option>`;
            })
            .join("");
      }

      if (msg) {
        msg.className = "w3-small w3-center w3-text-gray";
        msg.textContent = "";
      }
    } catch (error) {
      console.error(error);
      list.innerHTML = `<div class="w3-text-red w3-small">${error.message}</div>`;
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
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

    const academyId = academySel.value;
    if (!academyId) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Debes seleccionar una academia.";
      return;
    }
    if (!name) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "El nombre de la categoria es obligatorio.";
      return;
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const isEdit = Boolean(editingCategoryId);
      const url = isEdit
        ? `${getApiUrl()}/categories/${editingCategoryId}`
        : `${getApiUrl()}/categories/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({
          academy_id: Number(academyId),
          name,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo guardar la categoria");

      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = isEdit
        ? "Categoria actualizada correctamente."
        : "Categoria creada correctamente.";

      cancelEditCategory();
      await adminReloadCategoriesUI();
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  async function toggleCategoryStatus(categoryId, isActive) {
    try {
      const res = await fetch(`${getApiUrl()}/categories/${categoryId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el estado");
      await adminReloadCategoriesUI();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function deleteCategory(categoryId) {
    const ok = await showConfirmModal("\u00bfEliminar esta categoria?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/categories/${categoryId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo eliminar la categoria");
      await adminReloadCategoriesUI();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function adminReloadLevelsUI() {
    const selLvlCat = document.getElementById("admLvlCategory");
    const list = document.getElementById("admLvlList");
    const msg = document.getElementById("admLvlMsg");

    if (!list) return;
    list.innerHTML = `<div class="w3-text-gray w3-small">Cargando niveles...</div>`;

    const categoryId = selLvlCat ? selLvlCat.value : "";

    if (!categoryId) {
      list.innerHTML = `<div class="w3-text-gray w3-small">
        Selecciona una categoria para ver sus niveles.
      </div>`;
      return;
    }

    try {
      const res = await fetch(
        `${getApiUrl()}/levels/?category_id=${categoryId}&include_inactive=true`,
        { headers: authHeaders() }
      );
      const levels = await res.json();
      if (!res.ok) throw new Error(levels.detail || "No se pudieron cargar los niveles");

      if (!levels.length) {
        list.innerHTML = `<div class="w3-text-gray w3-small">No hay niveles para esta categoria.</div>`;
      } else {
        const pageItems = paginateList(levels, "adminLevels", "admLvlList", adminReloadLevelsUI);

        list.innerHTML = pageItems
          .map((level) => {
            const statusText = level.is_active ? "Activo" : "Inactivo";
            const statusClass = level.is_active ? "w3-text-green" : "w3-text-red";
            const toggleText = level.is_active ? "Inactivar" : "Activar";
            const deleteBtn = !level.is_active
              ? `<button
                  class="w3-button w3-red w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="window.DashboardMaintenance.deleteLevel(${level.id})">
                  Eliminar
                </button>`
              : "";
            return `
          <div class="w3-padding-small w3-border-bottom">
            <div>
              <span class="w3-tag w3-round-xxlarge w3-pale-green">
                ${level.name}
              </span>
              <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span>
            </div>
            <div class="w3-small w3-text-gray">${level.description || ""}</div>
            <div class="w3-small w3-margin-top">
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny"
                onclick='window.DashboardMaintenance.openEditLevel(${JSON.stringify(level)})'>
                Editar
              </button>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="window.DashboardMaintenance.toggleLevelStatus(${level.id}, ${!level.is_active})">
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
    } catch (error) {
      console.error(error);
      list.innerHTML = `<div class="w3-text-red w3-small">${error.message}</div>`;
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
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

    const categoryId = selLvlCat.value;
    if (!categoryId) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Debes seleccionar una categoria.";
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
      const url = isEdit ? `${getApiUrl()}/levels/${editingLevelId}` : `${getApiUrl()}/levels/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ category_id: Number(categoryId), name, description: description || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo guardar el nivel");

      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = isEdit
        ? "Nivel actualizado correctamente."
        : "Nivel creado correctamente.";

      cancelEditLevel();
      await adminReloadLevelsUI();
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  async function toggleLevelStatus(levelId, isActive) {
    try {
      const res = await fetch(`${getApiUrl()}/levels/${levelId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el estado");
      await adminReloadLevelsUI();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function deleteLevel(levelId) {
    const ok = await showConfirmModal("\u00bfEliminar este nivel?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/levels/${levelId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo eliminar el nivel");
      await adminReloadLevelsUI();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function adminInitMaintenance() {
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

    await adminReloadAcademiesUI();
    await adminReloadCategoriesUI();
    await adminReloadLevelsUI();
  }

  window.DashboardMaintenance = {
    adminInitMaintenance,
    adminReloadAcademiesUI,
    adminCreateAcademy,
    toggleAcademyStatus,
    deleteAcademy,
    openEditAcademy,
    cancelEditAcademy,
    adminReloadCategoriesUI,
    adminCreateCategory,
    toggleCategoryStatus,
    deleteCategory,
    openEditCategory,
    cancelEditCategory,
    adminReloadLevelsUI,
    adminCreateLevel,
    toggleLevelStatus,
    deleteLevel,
    openEditLevel,
    cancelEditLevel,
  };
})();