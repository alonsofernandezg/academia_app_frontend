(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para users.");
  }

  const {
    authHeaders,
    getApiBase,
    paginateList,
    renderStateBlock,
    setStatusMessage,
    showConfirmModal,
    showAlertModal,
  } = dashboardCommon;

  function getApiUrl() {
    return getApiBase();
  }

  function formatUserRoleLabel(role) {
    if (role === "coach") return "Entrenador";
    if (role === "admin") return "Admin";
    if (role === "general") return "General";
    return role || "-";
  }

  function updateUsersWorkspaceSummary(users) {
    if (!window.DashboardShell?.setWorkspaceModuleSummary) return;

    const activeCount = users.filter((user) => user.is_active).length;
    const coachCount = users.filter((user) => user.role === "coach").length;

    window.DashboardShell.setWorkspaceModuleSummary("admin", "users", {
      metrics: [
        { label: "Cuentas", value: String(users.length) },
        { label: "Activas", value: String(activeCount) },
        { label: "Coaches", value: String(coachCount) },
      ],
    });
  }

  async function loadUsers() {
    const box = document.getElementById("usersList");
    if (!box) return;
    box.innerHTML = renderStateBlock(
      "loading",
      "Estamos preparando los accesos",
      "En unos segundos verás las cuentas activas y las pendientes de revisión."
    );
    try {
      const res = await fetch(`${getApiUrl()}/admin/users`, { headers: authHeaders() });
      const users = await res.json();
      if (!res.ok) throw new Error(users.detail || "No se pudieron cargar los usuarios");

      updateUsersWorkspaceSummary(users);

      if (!users.length) {
        box.innerHTML = renderStateBlock(
          "empty",
          "Todavía no hay cuentas creadas",
          "Usa Crear usuario para invitar el primer acceso administrativo o de entrenador."
        );
        return;
      }

      const pageItems = paginateList(users, "users", "usersList", loadUsers);

      box.innerHTML = pageItems
        .map((user) => {
          const canResendInvite = !user.is_verified && (user.role === "coach" || user.role === "admin");
          const actionButton = user.is_verified
            ? `
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                onclick="window.DashboardUsers.resetUserPassword(${user.id})">
                <span class="ui-icon-label"><span class="ui-icon ui-icon--brand" aria-hidden="true">vpn_key</span><span>Enviar clave temporal</span></span>
              </button>
              `
            : canResendInvite
              ? `
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-small w3-margin-left"
                onclick="window.DashboardUsers.resendInvite(${user.id})">
                <span class="ui-icon-label"><span class="ui-icon ui-icon--brand" aria-hidden="true">mail</span><span>Reenviar invitación</span></span>
              </button>
              `
              : "";

          return `
        <div class="w3-card w3-round-xxlarge w3-padding w3-margin-bottom">
          <div class="w3-row">
            <div class="w3-col s12 m7">
              <b>${user.email}</b><br>
              <span class="w3-small w3-text-gray">Rol: ${formatUserRoleLabel(user.role)}</span>
            </div>
            <div class="w3-col s12 m5 w3-right-align">
              <span class="w3-small ${user.is_active ? "w3-text-green" : "w3-text-red"}" style="margin-right:8px">
                ${user.is_active ? "Activo" : "Inactivo"}
              </span>
              <span class="w3-small ${user.is_verified ? "w3-text-green" : "w3-text-orange"}" style="margin-right:8px">
                ${user.is_verified ? "Verificado" : "Pendiente"}
              </span>
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                onclick='window.DashboardUsers.openEditUser(${JSON.stringify(user)})'>
                <span class="ui-icon-label"><span class="ui-icon ui-icon--brand" aria-hidden="true">edit_square</span><span>Editar</span></span>
              </button>
              ${actionButton}
              <button
                class="w3-button w3-white w3-border w3-round-xxlarge w3-small"
                style="margin-left:6px"
                onclick="window.DashboardUsers.toggleStatus(${user.id})">
                ${user.is_active ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        </div>
      `;
        })
        .join("");
    } catch (error) {
      box.innerHTML = renderStateBlock(
        "error",
        "No pudimos cargar los accesos",
        error.message || "Intenta actualizar la vista en unos segundos."
      );
    }
  }

  async function toggleStatus(userId) {
    try {
      const res = await fetch(`${getApiUrl()}/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo cambiar el estado");
      await loadUsers();
    } catch (error) {
      showAlertModal(error.message);
    }
  }

  async function resetUserPassword(userId) {
    const ok = await showConfirmModal("¿Enviar una nueva clave temporal? La persona recibirá el acceso por correo.");
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.detail || "No pudimos restablecer la contraseña. Intenta de nuevo."
        );
      }
      showAlertModal(
        data.message || "Listo. Enviamos una nueva clave temporal al correo del usuario."
      );
    } catch (error) {
      showAlertModal(error.message || "No fue posible enviar la clave temporal en este momento.");
    }
  }

  async function resendInvite(userId) {
    const ok = await showConfirmModal(
      "¿Reenviar la invitación? Se generará una nueva contraseña temporal y un nuevo código de verificación."
    );
    if (!ok) return;
    try {
      const res = await fetch(`${getApiUrl()}/admin/users/${userId}/resend-invite`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "No pudimos reenviar la invitación. Intenta de nuevo.");
      }
      showAlertModal(data.message || "Listo. Reenviamos la invitación al correo del usuario.");
      await loadUsers();
    } catch (error) {
      showAlertModal(error.message || "No fue posible reenviar la invitación en este momento.");
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
      setStatusMessage(msg, "Guardando cambios...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/admin/create_user`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email, role: roleSel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo crear el usuario");
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Usuario listo. La invitación ya salió por correo.";
      await loadUsers();
      setTimeout(closeCreateUser, 800);
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  function openEditUser(user) {
    document.getElementById("euId").value = user.id;
    document.getElementById("euEmail").value = user.email;
    document.getElementById("euRole").value = user.role || "general";
    document.getElementById("euActive").value = String(user.is_active);
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
    const isActive = document.getElementById("euActive").value === "true";
    const msg = document.getElementById("euMsg");
    msg.textContent = "";

    try {
      setStatusMessage(msg, "Guardando cambios...", "w3-small w3-text-gray w3-center");
      const res = await fetch(`${getApiUrl()}/admin/users/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ email, role: roleSel, is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el usuario");
      msg.className = "w3-small w3-text-green w3-center";
      msg.textContent = "Cambios guardados correctamente.";
      await loadUsers();
      setTimeout(closeEditUser, 700);
    } catch (error) {
      msg.className = "w3-small w3-text-red w3-center";
      msg.textContent = error.message;
    }
  }

  window.DashboardUsers = {
    loadUsers,
    toggleStatus,
    resetUserPassword,
    resendInvite,
    openCreateUser,
    closeCreateUser,
    createUser,
    openEditUser,
    closeEditUser,
    updateUser,
  };
})();
