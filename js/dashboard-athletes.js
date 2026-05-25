(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para athletes.");
  }

  const {
    authHeaders,
    resolveFileUrl,
    computeAge,
    formatBirth,
    setStatusMessage,
    getFilterValues,
    athleteMatchesFilters,
    buildFilterOptionsFromAthletes,
    initAthleteFilters,
    paginateList,
    showConfirmModal,
    showAlertModal,
  } = dashboardCommon;

  let adminAthletesCache = [];
  let coachAthletesCache = [];
  let adminFiltersInit = false;
  let coachFiltersInit = false;

  function getApiUrl() {
    const rawBase = String(window.API_BASE || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  function getRole() {
    return window.role || localStorage.getItem("role") || "general";
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getUserId() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.user_id;
    } catch {
      return null;
    }
  }

  function fillGeneralPlanAthleteSelect(athletes) {
    const billingModule = window.DashboardBilling;
    if (!billingModule || typeof billingModule.fillGeneralPlanAthleteSelect !== "function") return;
    billingModule.fillGeneralPlanAthleteSelect(athletes || []);
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
    const filtered = cache.filter((athlete) => athleteMatchesFilters(athlete, filters));
    return { filters, filtered };
  }

  function getFilteredAssignmentsForExport(assignments, filters) {
    const list = assignments || [];
    const assignmentFilters = [
      ["academy_id", filters.academyId],
      ["category_id", filters.categoryId],
      ["level_id", filters.levelId],
      ["coach_user_id", filters.coachId],
    ].filter(([, value]) => value);
    if (!assignmentFilters.length) return list;
    return list.filter((assignment) =>
      assignmentFilters.every(([key, value]) => String(assignment[key] || "") === String(value))
    );
  }

  function formatAssignmentsForExport(athlete, filters) {
    const assignments = getFilteredAssignmentsForExport(athlete.assignments || [], filters);
    if (!assignments.length) return "-";
    return assignments
      .map((assignment) => {
        const coach = assignment.coach_name ? ` (Entrenador: ${assignment.coach_name})` : "";
        return `${assignment.academy_name || "-"} / ${assignment.category_name || "-"} / ${assignment.level_name || "-"}${coach}`;
      })
      .join("; ");
  }

  function exportAthletesCsv(scope) {
    const { filters, filtered } = getFilteredAthletesForExport(scope);
    if (!filtered.length) {
      showAlertModal("No hay datos para exportar.");
      return;
    }
    const headers = [
      "Nombre",
      "Identificación",
      "Género",
      "Nacimiento",
      "Edad",
      "Altura (cm)",
      "Peso (kg)",
      "Disciplina",
      "Asignaciones",
    ];
    const rows = filtered.map((athlete) => {
      const birth = athlete.birth_date ? formatBirth(athlete.birth_date) : "";
      const age = computeAge(athlete.birth_date);
      return [
        `${athlete.first_name || ""} ${athlete.last_name || ""}`.trim(),
        athlete.id_number || "",
        formatAthleteGender(athlete.gender),
        birth,
        age === null ? "" : age,
        athlete.height_cm || "",
        athlete.weight_kg || "",
        athlete.discipline || "",
        formatAssignmentsForExport(athlete, filters),
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `reporte_deportistas_${scope}_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportAthletesPdf(scope) {
    const { filters, filtered } = getFilteredAthletesForExport(scope);
    if (!filtered.length) {
      showAlertModal("No hay datos para exportar.");
      return;
    }
    const rows = filtered
      .map((athlete) => {
        const birth = athlete.birth_date ? formatBirth(athlete.birth_date) : "-";
        const age = computeAge(athlete.birth_date);
        const assignments = formatAssignmentsForExport(athlete, filters);
        return `
          <tr>
            <td>${athlete.first_name || ""} ${athlete.last_name || ""}</td>
            <td>${athlete.id_number || "-"}</td>
            <td>${formatAthleteGender(athlete.gender)}</td>
            <td>${birth}</td>
            <td>${age === null ? "-" : age}</td>
            <td>${athlete.height_cm || "-"}</td>
            <td>${athlete.weight_kg || "-"}</td>
            <td>${athlete.discipline || "-"}</td>
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
                <th>Identificación</th>
                <th>Género</th>
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
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  function openCreateAthlete() {
    const defaultDiscipline = "Fútbol";
    const fieldIds = [
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

    fieldIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.value = "";
    });

    const academySelect = document.getElementById("aAcademy");
    if (academySelect) academySelect.value = "";

    const disciplineInput = document.getElementById("aDiscipline");
    if (disciplineInput) disciplineInput.value = defaultDiscipline;

    const msg = document.getElementById("aMsg");
    if (msg) msg.textContent = "";

    const modal = document.getElementById("modalCreateAthlete");
    if (modal) modal.style.display = "block";
  }

  function closeCreateAthlete() {
    const modal = document.getElementById("modalCreateAthlete");
    if (modal) modal.style.display = "none";
  }

  async function createAthlete() {
    const firstName = document.getElementById("aFirst")?.value.trim() || "";
    const lastName = document.getElementById("aLast")?.value.trim() || "";
    const idNumber = document.getElementById("aIdNumber")?.value.trim() || "";
    const academyId = document.getElementById("aAcademy")?.value || "";
    const birthDate = document.getElementById("aBirth")?.value || "";
    const gender = document.getElementById("aGender")?.value || "";
    const heightCm = document.getElementById("aHeight")?.value || "";
    const weightKg = document.getElementById("aWeight")?.value || "";
    const discipline = document.getElementById("aDiscipline")?.value || "";
    const notes = document.getElementById("aNotes")?.value || "";
    const photo = document.getElementById("aPhoto")?.files?.[0] || null;
    const msg = document.getElementById("aMsg");

    if (msg) msg.textContent = "";

    if (!firstName || !lastName || !idNumber || !academyId) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = "Nombre, apellido, identificación y academia son obligatorios.";
      }
      return;
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const formData = new FormData();
      formData.append("id_number", idNumber);
      formData.append("full_name", `${firstName} ${lastName}`);
      formData.append("academy_id", academyId);

      if (birthDate) formData.append("birth_date", birthDate);
      if (gender) formData.append("gender", gender);
      if (heightCm) formData.append("height_cm", heightCm);
      if (weightKg) formData.append("weight_kg", weightKg);
      if (discipline) formData.append("discipline", discipline);
      if (notes) formData.append("notes", notes);
      if (photo) formData.append("file", photo);

      const res = await fetch(`${getApiUrl()}/athletes/create`, {
        method: "POST",
        headers: { Authorization: "Bearer " + getToken() },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo crear el atleta");

      if (msg) {
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = "✅ Atleta creado correctamente.";
      }
      await loadAthletes();
      setTimeout(closeCreateAthlete, 800);
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  function openEditAthlete(athlete) {
    const editId = document.getElementById("editId");
    const editIdNumber = document.getElementById("eIdNumber");
    const firstName = document.getElementById("eFirst");
    const lastName = document.getElementById("eLast");
    const birthDate = document.getElementById("eBirth");
    const gender = document.getElementById("eGender");
    const height = document.getElementById("eHeight");
    const weight = document.getElementById("eWeight");
    const discipline = document.getElementById("eDiscipline");
    const notes = document.getElementById("eNotes");
    const msg = document.getElementById("eaMsg");
    const modal = document.getElementById("modalEditAthlete");

    if (editId) editId.value = athlete.id;
    if (editIdNumber) editIdNumber.value = athlete.id_number || "";
    if (firstName) firstName.value = athlete.first_name || "";
    if (lastName) lastName.value = athlete.last_name || "";
    if (birthDate) birthDate.value = athlete.birth_date ? athlete.birth_date.split("T")[0] : "";
    if (gender) gender.value = athlete.gender || "";
    if (height) height.value = athlete.height_cm || "";
    if (weight) weight.value = athlete.weight_kg || "";
    if (discipline) discipline.value = athlete.discipline || "";
    if (notes) notes.value = athlete.notes || "";
    if (msg) msg.textContent = "";
    if (modal) modal.style.display = "block";
  }

  function closeEditAthlete() {
    const modal = document.getElementById("modalEditAthlete");
    if (modal) modal.style.display = "none";
  }

  async function updateAthlete() {
    const id = document.getElementById("editId")?.value || "";
    const msg = document.getElementById("eaMsg");
    const idNumber = document.getElementById("eIdNumber")?.value.trim() || "";

    const formData = new FormData();
    formData.append("id_number", idNumber);
    formData.append("first_name", document.getElementById("eFirst")?.value.trim() || "");
    formData.append("last_name", document.getElementById("eLast")?.value.trim() || "");
    formData.append("birth_date", document.getElementById("eBirth")?.value || "");
    formData.append("gender", document.getElementById("eGender")?.value || "");
    formData.append("height_cm", document.getElementById("eHeight")?.value || "");
    formData.append("weight_kg", document.getElementById("eWeight")?.value || "");
    formData.append("discipline", document.getElementById("eDiscipline")?.value || "");
    formData.append("notes", document.getElementById("eNotes")?.value || "");

    const file = document.getElementById("ePhoto")?.files?.[0];
    if (file) formData.append("file", file);

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/athletes/update/${id}`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + getToken() },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al actualizar atleta");

      if (msg) {
        msg.className = "w3-small w3-text-green w3-center";
        msg.textContent = "✅ Atleta actualizado correctamente.";
      }
      await loadAthletes();
      setTimeout(closeEditAthlete, 800);
    } catch (error) {
      if (msg) {
        msg.className = "w3-small w3-text-red w3-center";
        msg.textContent = error.message;
      }
    }
  }

  async function deleteAthlete(id) {
    const ok = await showConfirmModal("¿Eliminar este atleta?");
    if (!ok) return;

    try {
      const res = await fetch(`${getApiUrl()}/athletes/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + getToken() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo eliminar el atleta");
      showAlertModal(data.message ? `✅ ${data.message}` : "Atleta eliminado correctamente.");
      await loadAthletes();
    } catch (error) {
      showAlertModal(`Error: ${error.message}`);
    }
  }

  async function reactivateAthlete(id) {
    const ok = await showConfirmModal("¿Reactivar este atleta?");
    if (!ok) return;

    try {
      const res = await fetch(`${getApiUrl()}/athletes/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo reactivar el atleta");
      await loadAthletes();
    } catch (error) {
      showAlertModal(`Error: ${error.message}`);
    }
  }

  function renderAdminAthletes() {
    const box = document.getElementById("athleteList");
    if (!box) return;

    const currentRole = getRole();
    const filters = getFilterValues("admin");
    const filtered = adminAthletesCache.filter((athlete) => athleteMatchesFilters(athlete, filters));

    if (!filtered.length) {
      box.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay atletas registrados.</div>`;
      return;
    }

    const pageItems = paginateList(filtered, "adminAthletes", "athleteList", renderAdminAthletes);

    box.innerHTML = pageItems
      .map((athlete) => {
        let buttons = "";
        const isActive = athlete.is_active !== false;
        const statusText = isActive ? "Activo" : "Inactivo";
        const statusClass = isActive ? "w3-text-green" : "w3-text-red";
        const reactivateBtn =
          !isActive && currentRole !== "coach"
            ? `<button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                onclick='window.DashboardAthletes.reactivateAthlete(${athlete.id})'>
                Reactivar
              </button>`
            : "";
        const assignments = (athlete.assignments || [])
          .map((assignment) => {
            const coachText = assignment.coach_name ? ` • Entrenador: ${assignment.coach_name}` : "";
            return `
              <span class="w3-tag w3-round-xxlarge w3-light-gray w3-small w3-margin-right w3-margin-bottom">
                ${assignment.academy_name || "-"} / ${assignment.category_name || "-"} / ${assignment.level_name || "-"}${coachText}
              </span>
            `;
          })
          .join("");

        if ((currentRole === "admin" || currentRole === "general") && isActive) {
          buttons = `
          <button
            class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
            onclick='window.DashboardAthletes.openEditAthlete(${JSON.stringify(athlete)})'>
            ✏️ Editar
          </button>
          <button
            class="w3-button w3-red w3-round-xxlarge w3-small w3-margin-left"
            onclick='window.DashboardAthletes.deleteAthlete(${athlete.id})'>
            🗑️ Eliminar
          </button>
        `;
        }

        const assignBtn =
          currentRole === "admin" && isActive
            ? `<button
                class="w3-button w3-blue w3-round-xxlarge w3-small w3-margin-left"
                onclick="window.DashboardAthletes.openAssignLevel(${athlete.id})">
                + Asignar nivel
              </button>`
            : "";

        const genderText = formatAthleteGender(athlete.gender);
        const showBirth = currentRole === "admin";
        const birthText = showBirth ? formatBirth(athlete.birth_date) : "";
        const ageText = showBirth ? computeAge(athlete.birth_date) : null;
        const ageLabel = ageText === null ? "-" : `${ageText}`;

        return `
        <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom w3-row">
          <div class="w3-col s3 m2">
            ${
              athlete.photo_url
                ? `<img src="${resolveFileUrl(athlete.photo_url)}" class="w3-image w3-round-xxlarge" style="max-height:80px;">`
                : `<div class="w3-gray w3-round-xxlarge" style="height:80px"></div>`
            }
          </div>
          <div class="w3-col s9 m10">
            <b>${athlete.first_name} ${athlete.last_name}</b> <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span><br>
            <span class="w3-small w3-text-gray">
            ID: ${athlete.id_number || "-"} | ${genderText} | ${athlete.discipline || "Sin disciplina"}
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
              onclick="window.DashboardAthletes.openAthleteDetail(${athlete.id})">
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
    if (!box) return;
    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando atletas...</div>`;
    try {
      const currentRole = getRole();
      const url =
        currentRole === "admin"
          ? `${getApiUrl()}/athletes/my?include_inactive=true`
          : `${getApiUrl()}/athletes/my`;
      const res = await fetch(url, { headers: authHeaders() });
      const athletes = await res.json();
      if (!res.ok) throw new Error(athletes.detail || "No se pudieron cargar los atletas");

      adminAthletesCache = athletes;
      if (currentRole === "general") {
        fillGeneralPlanAthleteSelect(athletes);
      }
      buildFilterOptionsFromAthletes(adminAthletesCache, "admin");
      renderAdminAthletes();
      if (!adminFiltersInit) {
        initAthleteFilters("admin", renderAdminAthletes);
        adminFiltersInit = true;
      }

      const filtersBox = document.getElementById("adminAthleteFilters");
      if (filtersBox && currentRole !== "admin") {
        filtersBox.style.display = "none";
      }
    } catch (error) {
      box.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  async function loadCoachAthletePanels() {
    const allList = document.getElementById("coachAllAthletesList");
    const teamsList = document.getElementById("coachTeamsList");
    if (!allList || !teamsList) return;

    allList.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando atletas...</div>`;
    teamsList.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando equipos...</div>`;

    const coachUserId = getUserId();
    if (!coachUserId) {
      allList.innerHTML = `<div class="w3-center w3-text-red w3-small">No se pudo leer el usuario.</div>`;
      teamsList.innerHTML = `<div class="w3-center w3-text-red w3-small">No se pudo leer el usuario.</div>`;
      return;
    }

    try {
      const currentRole = getRole();
      const url =
        currentRole === "admin"
          ? `${getApiUrl()}/athletes/my?include_inactive=true`
          : `${getApiUrl()}/athletes/my`;
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
      coachAthletesCache.forEach((athlete) => {
        (athlete.assignments || []).forEach((assignment) => {
          if (assignment.coach_user_id !== coachUserId) return;
          const key = `${assignment.academy_name || "-"}|${assignment.category_name || "-"}|${assignment.level_name || "-"}`;
          if (!teams[key]) {
            teams[key] = {
              academy: assignment.academy_name || "-",
              category: assignment.category_name || "-",
              level: assignment.level_name || "-",
              athletes: [],
            };
          }
          teams[key].athletes.push({
            id: athlete.id,
            name: `${athlete.first_name} ${athlete.last_name}`,
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
              (athlete) => `
            <div class="w3-small w3-padding-small">
              ${athlete.name}
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                onclick="window.DashboardAthletes.openAthleteDetail(${athlete.id})">
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
    } catch (error) {
      allList.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
      teamsList.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  function renderCoachAllAthletes() {
    const allList = document.getElementById("coachAllAthletesList");
    if (!allList) return;

    const filtered = coachAthletesCache.filter((athlete) => athleteMatchesFilters(athlete, getFilterValues("coach")));

    if (!filtered.length) {
      allList.innerHTML = `<div class="w3-center w3-text-gray w3-small">No hay atletas registrados.</div>`;
      return;
    }

    const pageItems = paginateList(filtered, "coachAthletes", "coachAllAthletesList", renderCoachAllAthletes);

    allList.innerHTML = pageItems
      .map((athlete) => {
        const isActive = athlete.is_active !== false;
        const statusText = isActive ? "Activo" : "Inactivo";
        const statusClass = isActive ? "w3-text-green" : "w3-text-red";
        const assignments = (athlete.assignments || [])
          .map((assignment) => {
            const coachText = assignment.coach_name ? ` • Entrenador: ${assignment.coach_name}` : "";
            return `
              <span class="w3-tag w3-round-xxlarge w3-light-gray w3-small w3-margin-right w3-margin-bottom">
                ${assignment.academy_name || "-"} / ${assignment.category_name || "-"} / ${assignment.level_name || "-"}${coachText}
              </span>
            `;
          })
          .join("");
        const genderText = formatAthleteGender(athlete.gender);
        const birthText = formatBirth(athlete.birth_date);
        const ageText = computeAge(athlete.birth_date);
        const ageLabel = ageText === null ? "-" : `${ageText}`;
        return `
        <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom w3-row">
          <div class="w3-col s3 m2">
            ${
              athlete.photo_url
                ? `<img src="${resolveFileUrl(athlete.photo_url)}" class="w3-image w3-round-xxlarge" style="max-height:80px;">`
                : `<div class="w3-gray w3-round-xxlarge" style="height:80px"></div>`
            }
          </div>
          <div class="w3-col s9 m10">
            <b>${athlete.first_name} ${athlete.last_name}</b> <span class="w3-small ${statusClass}" style="margin-left:6px">${statusText}</span><br>
            <span class="w3-small w3-text-gray">
              ID: ${athlete.id_number || "-"} · ${genderText} · ${athlete.discipline || "Sin disciplina"}
            </span><br>
            <span class="w3-small w3-text-gray">
              Nacimiento: ${birthText} · Edad: ${ageLabel}
            </span><br>
            <div class="w3-margin-top">${assignments || ""}</div>
            <button
              class="w3-button w3-blue w3-round-xxlarge w3-small w3-margin-top"
              onclick="window.DashboardAthletes.openAssignLevel(${athlete.id})">
              + Asignar nivel
            </button>
            <button
              class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left w3-margin-top"
              onclick="window.DashboardAthletes.openAthleteDetail(${athlete.id})">
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

    const currentRole = getRole();
    body.innerHTML = `<div class="w3-center w3-text-gray w3-small">Cargando detalle...</div>`;
    modal.style.display = "block";

    try {
      const res = await fetch(`${getApiUrl()}/athletes/${athleteId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo cargar el atleta");

      const assignments = (data.assignments || [])
        .map((assignment) => {
          const coachText = assignment.coach_name ? ` • Entrenador: ${assignment.coach_name}` : "";
          const removeBtn =
            currentRole === "admin" || (currentRole === "coach" && assignment.coach_user_id === getUserId())
              ? `<button
                  class="w3-button w3-white w3-border w3-round-xxlarge w3-tiny w3-margin-left"
                  onclick="window.DashboardAthletes.removeAthleteAssignment(${data.id}, ${assignment.id})">
                  Quitar
                </button>`
              : "";
          return `
            <div class="w3-padding-small w3-border-bottom">
              <span class="w3-small">
                ${assignment.academy_name || "-"} / ${assignment.category_name || "-"} / ${assignment.level_name || "-"}${coachText}
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
    } catch (error) {
      body.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
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

    const currentRole = getRole();
    document.getElementById("assignAthleteId").value = athleteId;
    msg.textContent = "";
    levelSel.innerHTML = `<option value="">Seleccione un nivel…</option>`;

    if (currentRole === "admin") {
      if (coachWrap) coachWrap.style.display = "block";
      if (coachSel) {
        coachSel.innerHTML = `<option value="">Seleccione un entrenador…</option>`;
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
    const select = document.getElementById("assignCoachUserId");
    if (!select) return;

    try {
      const res = await fetch(`${getApiUrl()}/coaches/`, { headers: authHeaders() });
      const coaches = await res.json();
      if (!res.ok) throw new Error(coaches.detail || "No se pudieron cargar los entrenadores");
      select.innerHTML =
        `<option value="">Seleccione un entrenador…</option>` +
        coaches.map((coach) => `<option value="${coach.user_id}">${coach.full_name}</option>`).join("");
    } catch (error) {
      select.innerHTML = `<option value="">Error cargando entrenadores</option>`;
    }
  }

  async function loadLevelsForCoach(coachUserId) {
    const levelSel = document.getElementById("assignLevelId");
    if (!levelSel) return;

    try {
      const res = await fetch(`${getApiUrl()}/admin/coach-assignments/coach/${coachUserId}?active_only=true`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");
      levelSel.innerHTML =
        `<option value="">Seleccione un nivel…</option>` +
        data
          .map(
            (assignment) =>
              `<option value="${assignment.level_id}">${assignment.academy_name} / ${assignment.category_name} / ${assignment.level_name}</option>`
          )
          .join("");
    } catch (error) {
      levelSel.innerHTML = `<option value="">Error cargando niveles</option>`;
    }
  }

  async function loadLevelsForCurrentCoach() {
    const levelSel = document.getElementById("assignLevelId");
    if (!levelSel) return;

    try {
      const res = await fetch(`${getApiUrl()}/admin/coach-assignments/my/active`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudieron cargar los niveles");
      levelSel.innerHTML =
        `<option value="">Seleccione un nivel…</option>` +
        data
          .map(
            (assignment) =>
              `<option value="${assignment.level_id}">${assignment.academy_name} / ${assignment.category_name} / ${assignment.level_name}</option>`
          )
          .join("");
    } catch (error) {
      levelSel.innerHTML = `<option value="">Error cargando niveles</option>`;
    }
  }

  async function saveAssignLevel() {
    const athleteId = document.getElementById("assignAthleteId").value;
    const coachSel = document.getElementById("assignCoachUserId");
    const levelSel = document.getElementById("assignLevelId");
    const msg = document.getElementById("assignLevelMsg");
    if (!athleteId || !levelSel || !msg) return;

    const currentRole = getRole();
    msg.textContent = "";
    const levelId = levelSel.value ? Number(levelSel.value) : null;
    if (!levelId) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = "Debes seleccionar un nivel.";
      return;
    }

    const payload = { level_id: levelId };
    if (currentRole === "admin" && coachSel && coachSel.value) {
      payload.coach_user_id = Number(coachSel.value);
    }

    try {
      setStatusMessage(msg, "Guardando...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/athletes/${athleteId}/assignments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo asignar el nivel");
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Asignación creada correctamente.";
      await loadAthletes();
      if (currentRole === "coach") {
        await loadCoachAthletePanels();
      }
      setTimeout(closeAssignLevel, 700);
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  async function removeAthleteAssignment(athleteId, assignmentId) {
    const ok = await showConfirmModal("¿Quitar esta asignación?");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/athletes/${athleteId}/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo quitar la asignación");
      await openAthleteDetail(athleteId);
      await loadAthletes();
    } catch (error) {
      showAlertModal(`Error: ${error.message}`);
    }
  }

  window.DashboardAthletes = {
    exportAthletesCsv,
    exportAthletesPdf,
    openCreateAthlete,
    closeCreateAthlete,
    createAthlete,
    openEditAthlete,
    closeEditAthlete,
    updateAthlete,
    deleteAthlete,
    reactivateAthlete,
    loadAthletes,
    loadCoachAthletePanels,
    openAthleteDetail,
    closeAthleteDetail,
    openAssignLevel,
    closeAssignLevel,
    saveAssignLevel,
    removeAthleteAssignment,
  };
})();