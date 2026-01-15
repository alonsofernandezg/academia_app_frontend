const API_BASE = "http://127.0.0.1:8000";

// --- Router de vistas ---
function go(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add("active");

  // limpiar mensajes
  ["logMsg","regMsg","verMsg","fpMsg","cpMsg"].forEach(id=>{
    const el = document.getElementById(id); if (el) el.textContent="";
  });
  setAuthStatus();
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
      <br><a href="#" class="link" onclick="onLogout()">Cerrar sesión</a>`;
  } catch {
    el.innerHTML = `✅ Sesión activa · <a href="#" class="link" onclick="onLogout()">Cerrar sesión</a>`;
  }
}

// --- LOGIN ---
async function onLogin() {
  const email = document.getElementById("logEmail").value.trim();
  const password = document.getElementById("logPass").value;
  const box = document.getElementById("logMsg");
  box.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al iniciar sesión");

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role || "general");

    box.className = "ok w3-small w3-center";
    box.textContent = "✅ Login exitoso, redirigiendo...";

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
  } catch (err) {
    box.className = "err w3-small w3-center";
    box.textContent = err.message;
  }
}

// --- REGISTRO ---
async function onRegister() {
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;
  const confirm = document.getElementById("regConfirm").value;
  const box = document.getElementById("regMsg");
  box.textContent = "";

  if (password !== confirm) {
    box.className = "err w3-small w3-center";
    box.textContent = "Las contraseñas no coinciden";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirm_password: confirm }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al registrar");

    box.className = "ok w3-small w3-center";
    box.textContent = "✅ Cuenta creada. Revisa tu correo para verificar.";
    document.getElementById("verEmail").value = email;
    setTimeout(() => go("verify"), 800);
  } catch (err) {
    box.className = "err w3-small w3-center";
    box.textContent = err.message;
  }
}

// --- VERIFICAR CUENTA ---
async function onVerify() {
  const email = document.getElementById("verEmail").value.trim();
  const code = document.getElementById("verCode").value.trim();
  const box = document.getElementById("verMsg");
  box.textContent = "";

  try {
    const url = new URL(`${API_BASE}/auth/verify`);
    url.searchParams.set("email", email);
    url.searchParams.set("code", code);
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error de verificación");

    box.className = "ok w3-small w3-center";
    box.textContent = "OK. " + data.message + " Redirigiendo al inicio de sesiA3n...";
    setTimeout(() => go("login"), 800);
  } catch (err) {
    box.className = "err w3-small w3-center";
    box.textContent = err.message;
  }
}

// --- RECUPERAR CONTRASEÑA ---
async function onForgot() {
  const email = document.getElementById("fpEmail").value.trim();
  const box = document.getElementById("fpMsg");
  box.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al enviar correo");

    box.className = "ok w3-small w3-center";
    box.textContent = "📩 Correo enviado. Revisa tu bandeja.";
  } catch (err) {
    box.className = "err w3-small w3-center";
    box.textContent = err.message;
  }
}

// --- CAMBIAR CONTRASEÑA ---
async function onChangePassword() {
  const token = localStorage.getItem("token");
  const box = document.getElementById("cpMsg");
  box.textContent = "";

  if (!token) {
    box.className = "err w3-small w3-center";
    box.textContent = "Debes iniciar sesión primero.";
    return;
  }

  const current_password = document.getElementById("cpCurrent").value;
  const new_password = document.getElementById("cpNew").value;
  const confirm = document.getElementById("cpConfirm").value;

  if (new_password !== confirm) {
    box.className = "err w3-small w3-center";
    box.textContent = "Las contraseñas nuevas no coinciden";
    return;
  }

  try {
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

    box.className = "ok w3-small w3-center";
    box.textContent = "OK. " + data.message + " Redirigiendo al inicio de sesiA3n...";
    setTimeout(() => go("login"), 800);
  } catch (err) {
    box.className = "err w3-small w3-center";
    box.textContent = err.message;
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
  setAuthStatus();
  go("login");
});


