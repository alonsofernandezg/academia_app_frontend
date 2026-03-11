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

// Safety net: if any code still builds an insecure absolute HTTP URL while the
// page is HTTPS, upgrade it to HTTPS (except localhost) before sending.
(function enforceHttpsFetchOnSecurePages() {
	if (window.location.protocol !== "https:" || typeof window.fetch !== "function") return;

	const originalFetch = window.fetch.bind(window);

	function upgradeToHttps(url) {
		if (typeof url !== "string") return url;
		const trimmed = url.trim();
		if (!trimmed.startsWith("http://")) return url;
		if (trimmed.startsWith("http://127.0.0.1") || trimmed.startsWith("http://localhost")) return url;
		return `https://${trimmed.slice(7)}`;
	}

	window.fetch = function patchedFetch(input, init) {
		if (typeof input === "string") {
			return originalFetch(upgradeToHttps(input), init);
		}

		if (input instanceof Request) {
			const safeUrl = upgradeToHttps(input.url);
			if (safeUrl !== input.url) {
				const rebuilt = new Request(safeUrl, input);
				return originalFetch(rebuilt, init);
			}
		}

		return originalFetch(input, init);
	};
})();
