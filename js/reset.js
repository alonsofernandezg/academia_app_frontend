const API_BASE = (() => {
  const defaultBase = "http://127.0.0.1:8000";
  const rawBase = String(window.API_BASE || defaultBase).trim().replace(/\/+$/, "");
  if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
    return `https://${rawBase.slice(7)}`;
  }
  return rawBase;
})();
window.API_BASE = API_BASE;

// Obtener token desde la URL (?token=...)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

function setFeedback(element, kind, text) {
  if (!element) return;
  element.className = "feedback w3-small w3-margin-top";
  if (kind === "success") element.classList.add("ok");
  if (kind === "error") element.classList.add("err");
  if (kind === "muted") element.classList.add("w3-text-grey");
  element.textContent = text || "";
}

function setPending(button, pending) {
  if (!button) return;
  if (!button.dataset.defaultHtml) {
    button.dataset.defaultHtml = button.innerHTML;
  }
  button.disabled = pending;
  button.innerHTML = pending
    ? `<span class="ui-icon-label"><span class="ui-icon ui-icon--current" aria-hidden="true">progress_activity</span><span>Actualizando...</span></span>`
    : button.dataset.defaultHtml;
}

async function resetPassword() {
  const pass = document.getElementById("newPass").value;
  const confirm = document.getElementById("confirmPass").value;
  const msg = document.getElementById("msg");
  const redirect = document.getElementById("redirect");
  const submitBtn = document.getElementById("resetSubmitBtn");

  setFeedback(msg, null, "");
  setFeedback(redirect, "muted", "");

  if (!token) {
    setFeedback(msg, "error", "El enlace de restablecimiento no es válido o ya expiró.");
    return;
  }

  if (pass.trim().length < 8) {
    setFeedback(msg, "error", "La contraseña debe tener al menos 8 caracteres.");
    return;
  }

  if (pass !== confirm) {
    setFeedback(msg, "error", "Las contraseñas no coinciden.");
    return;
  }

  try {
    setPending(submitBtn, true);
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: pass })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al restablecer contraseña");

    setFeedback(msg, "success", "Contraseña actualizada correctamente.");

    // Mostrar indicador de redirección
    setFeedback(redirect, "muted", "Redirigiendo al inicio de sesión...");
    redirect.classList.add("fade");

    // Redirección automática después de 3 segundos
    setTimeout(() => {
      window.location.href = "index.html";
    }, 3000);

  } catch (err) {
    setFeedback(msg, "error", err.message);
  } finally {
    setPending(submitBtn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("newPass")?.focus();
  document.getElementById("resetForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    resetPassword();
  });
});
