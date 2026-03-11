const API_BASE = window.API_BASE;

// Obtener token desde la URL (?token=...)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

async function resetPassword() {
  const pass = document.getElementById("newPass").value;
  const confirm = document.getElementById("confirmPass").value;
  const msg = document.getElementById("msg");
  const redirect = document.getElementById("redirect");

  msg.textContent = "";
  redirect.textContent = "";

  if (pass.trim().length < 8) {
    msg.className = "err";
    msg.textContent = "La contraseña debe tener al menos 8 caracteres.";
    return;
  }

  if (pass !== confirm) {
    msg.className = "err";
    msg.textContent = "Las contraseñas no coinciden.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: pass })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al restablecer contraseña");

    msg.className = "ok";
    msg.textContent = "✅ Contraseña actualizada correctamente.";

    // Mostrar indicador de redirección
    redirect.textContent = "Redirigiendo al inicio de sesión...";
    redirect.classList.add("fade");

    // Redirección automática después de 3 segundos
    setTimeout(() => {
      window.location.href = "index.html";
    }, 3000);

  } catch (err) {
    msg.className = "err";
    msg.textContent = err.message;
  }
}
