// Global frontend config: set the backend base URL in one place.
// If the site is loaded over HTTPS, force API_BASE to HTTPS to avoid mixed content.
(function configureApiBase() {
	const defaultBase = "https://deportivaback-eudyf4h6csdfevgz.canadacentral-01.azurewebsites.net/";
	const rawBase = String(window.API_BASE || defaultBase).trim();
	const withoutTrailingSlash = rawBase.replace(/\/+$/, "");

	if (window.location.protocol === "https:" && withoutTrailingSlash.startsWith("http://")) {
		window.API_BASE = `https://${withoutTrailingSlash.slice(7)}`;
		return;
	}

	window.API_BASE = withoutTrailingSlash;
})();
