// Global frontend config: set the backend base URL in one place.
// If the site is loaded over HTTPS, force API_BASE to HTTPS to avoid mixed content.
(function configureApiBase() {
	const defaultBase = "http://127.0.0.1:8000";
	const rawBase = String(window.API_BASE || defaultBase).trim();
	const withoutTrailingSlash = rawBase.replace(/\/+$/, "");

	if (window.location.protocol === "https:" && withoutTrailingSlash.startsWith("http://")) {
		window.API_BASE = `https://${withoutTrailingSlash.slice(7)}`;
		return;
	}

	window.API_BASE = withoutTrailingSlash;
})();
