(function () {
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  function ensureInstallButton() {
    if (isStandalone()) return null;

    let shell = document.getElementById("pwaInstallShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "pwaInstallShell";
      shell.className = "pwa-install-shell";

      const button = document.createElement("button");
      button.id = "pwaInstallButton";
      button.type = "button";
      button.className = "pwa-install-cta";
      button.hidden = true;
      button.innerHTML = '<span class="ui-icon-label"><span class="ui-icon ui-icon--current" aria-hidden="true">download</span><span>Instalar app</span></span>';

      shell.appendChild(button);
      document.body.appendChild(shell);
    }

    return document.getElementById("pwaInstallButton");
  }

  let deferredPrompt = null;
  const installButton = ensureInstallButton();

  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!deferredPrompt) return;

      installButton.disabled = true;
      deferredPrompt.prompt();

      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        installButton.hidden = true;
        installButton.disabled = false;
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const button = ensureInstallButton();
    if (button) {
      button.hidden = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    document.getElementById("pwaInstallShell")?.remove();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Keep the app usable even when the browser blocks service workers.
      });
    });
  }
})();