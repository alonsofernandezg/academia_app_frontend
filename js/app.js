const API_BASE = (() => {
  const defaultBase = "http://127.0.0.1:8000";
  const rawBase = String(window.API_BASE || defaultBase).trim().replace(/\/+$/, "");
  if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
    return `https://${rawBase.slice(7)}`;
  }
  return rawBase;
})();
window.API_BASE = API_BASE;

const AUTH_MESSAGES = ["logMsg", "regMsg", "verMsg", "fpMsg", "cpMsg"];

function setMessage(box, kind, text) {
  if (!box) return;
  box.className = "auth-message w3-center w3-small w3-margin-top";
  if (kind === "success") box.classList.add("ok");
  if (kind === "error") box.classList.add("err");
  box.textContent = text || "";
}

function setButtonPending(button, pending, loadingText) {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent.trim();
  }
  button.disabled = pending;
  button.setAttribute("aria-busy", pending ? "true" : "false");
  button.textContent = pending ? loadingText : button.dataset.defaultText;
}

function focusFirstField(view) {
  const target = document.getElementById(`view-${view}`);
  if (!target) return;
  const firstField = target.querySelector("input, select, textarea, button");
  if (firstField) firstField.focus();
}

function bindAuthNavigation() {
  document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => go(button.dataset.goView));
  });
  document.querySelectorAll("[data-auth-logout]").forEach((button) => {
    button.addEventListener("click", onLogout);
  });
}

function bindAuthForms() {
  const bindings = [
    ["loginForm", onLogin],
    ["registerForm", onRegister],
    ["verifyForm", onVerify],
    ["forgotForm", onForgot],
    ["changePasswordForm", onChangePassword],
  ];
  bindings.forEach(([formId, handler]) => {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handler();
    });
  });
}

// --- Router de vistas ---
function go(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add("active");

  // limpiar mensajes
  AUTH_MESSAGES.forEach((id) => {
    const el = document.getElementById(id);
    setMessage(el, null, "");
  });
  setAuthStatus();
  focusFirstField(view);
}

// --- Estado de sesión en encabezado ---
function setAuthStatus() {
  const token = localStorage.getItem("token");
  const el = document.getElementById("authStatus");
  if (!el) return;
  if (!token) {
    el.innerHTML = `<span class="w3-text-grey">🔒 No autenticado</span>`;
    return;
  }
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const email = payload.sub || "";
    const role = localStorage.getItem("role") || "general";
    el.innerHTML = `✅ Sesión activa: <b>${email}</b> · Rol: <b>${role}</b>
      <br><button type="button" class="link-button" id="authStatusLogout">Cerrar sesión</button>`;
  } catch {
    el.innerHTML = `✅ Sesión activa · <button type="button" class="link-button" id="authStatusLogout">Cerrar sesión</button>`;
  }
  document.getElementById("authStatusLogout")?.addEventListener("click", onLogout);
}

// --- LOGIN ---
async function onLogin() {
  const email = document.getElementById("logEmail").value.trim();
  const password = document.getElementById("logPass").value;
  const box = document.getElementById("logMsg");
  const submitBtn = document.getElementById("logSubmitBtn");
  setMessage(box, null, "");

  try {
    setButtonPending(submitBtn, true, "Ingresando...");
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al iniciar sesión");

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role || "general");

    setMessage(box, "success", "Inicio de sesión exitoso. Redirigiendo...");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
  } catch (err) {
    setMessage(box, "error", err.message);
  } finally {
    setButtonPending(submitBtn, false, "Ingresando...");
  }
}

// --- REGISTRO ---
async function onRegister() {
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;
  const confirm = document.getElementById("regConfirm").value;
  const box = document.getElementById("regMsg");
  const submitBtn = document.getElementById("regSubmitBtn");
  setMessage(box, null, "");

  if (password !== confirm) {
    setMessage(box, "error", "Las contraseñas no coinciden.");
    return;
  }

  try {
    setButtonPending(submitBtn, true, "Creando cuenta...");
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirm_password: confirm }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al registrar");

    setMessage(box, "success", "Cuenta creada. Revisa tu correo para verificarla.");
    document.getElementById("verEmail").value = email;
    setTimeout(() => go("verify"), 800);
  } catch (err) {
    setMessage(box, "error", err.message);
  } finally {
    setButtonPending(submitBtn, false, "Creando cuenta...");
  }
}

// --- VERIFICAR CUENTA ---
async function onVerify() {
  const email = document.getElementById("verEmail").value.trim();
  const code = document.getElementById("verCode").value.trim();
  const box = document.getElementById("verMsg");
  const submitBtn = document.getElementById("verSubmitBtn");
  setMessage(box, null, "");

  try {
    setButtonPending(submitBtn, true, "Verificando...");
    const url = new URL(`${API_BASE}/auth/verify`);
    url.searchParams.set("email", email);
    url.searchParams.set("code", code);
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error de verificación");

    setMessage(box, "success", `${data.message} Redirigiendo al inicio de sesión...`);
    setTimeout(() => go("login"), 800);
  } catch (err) {
    setMessage(box, "error", err.message);
  } finally {
    setButtonPending(submitBtn, false, "Verificando...");
  }
}

// --- RECUPERAR CONTRASEÑA ---
async function onForgot() {
  const email = document.getElementById("fpEmail").value.trim();
  const box = document.getElementById("fpMsg");
  const submitBtn = document.getElementById("fpSubmitBtn");
  setMessage(box, null, "");

  try {
    setButtonPending(submitBtn, true, "Enviando enlace...");
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al enviar correo");

    setMessage(box, "success", "Correo enviado. Revisa tu bandeja.");
  } catch (err) {
    setMessage(box, "error", err.message);
  } finally {
    setButtonPending(submitBtn, false, "Enviando enlace...");
  }
}

// --- CAMBIAR CONTRASEÑA ---
async function onChangePassword() {
  const token = localStorage.getItem("token");
  const box = document.getElementById("cpMsg");
  const submitBtn = document.getElementById("cpSubmitBtn");
  setMessage(box, null, "");

  if (!token) {
    setMessage(box, "error", "Debes iniciar sesión primero.");
    return;
  }

  const current_password = document.getElementById("cpCurrent").value;
  const new_password = document.getElementById("cpNew").value;
  const confirm = document.getElementById("cpConfirm").value;

  if (new_password !== confirm) {
    setMessage(box, "error", "Las contraseñas nuevas no coinciden.");
    return;
  }

  try {
    setButtonPending(submitBtn, true, "Actualizando...");
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al cambiar contraseña");

    setMessage(box, "success", `${data.message} Redirigiendo al inicio de sesión...`);
    setTimeout(() => go("login"), 800);
  } catch (err) {
    setMessage(box, "error", err.message);
  } finally {
    setButtonPending(submitBtn, false, "Actualizando...");
  }
}

// --- LOGOUT ---
function onLogout() {
  localStorage.clear();
  setAuthStatus();
  go("login");
}

// Entrada inicial
document.addEventListener("DOMContentLoaded", () => {
  bindAuthNavigation();
  bindAuthForms();
  setAuthStatus();
  go("login");
});


