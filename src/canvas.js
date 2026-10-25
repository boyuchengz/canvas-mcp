/** Upper bound on pages followed per list request (100 items each). */
export const MAX_PAGES = 5;

/** Extracts the rel="next" target from a Canvas `Link` response header. */
export function parseNextLink(header) {
	const next = (header ?? "").split(",").find((part) => part.includes('rel="next"'));
	return next?.match(/<([^>]+)>/)?.[1];
}

export class CanvasError extends Error {
	constructor(status, statusText, body) {
		super(`Canvas API ${status} ${statusText}: ${body}`);
		this.status = status;
	}
}

/**
 * Minimal read-only client for the Canvas LMS REST API.
 * Every request it makes is a GET; there is intentionally no way to write.
 */
export function createCanvasClient({ baseUrl, token, userAgent, fetchImpl = globalThis.fetch }) {
	const origin = new URL(baseUrl).origin;

	function buildUrl(path, params = {}) {
		const url = new URL(`/api/v1${path}`, origin);
		for (const [key, value] of Object.entries(params)) {
			if (value === undefined) continue;
			if (Array.isArray(value)) for (const v of value) url.searchParams.append(key, v);
			else url.searchParams.set(key, String(value));
		}
		return url.toString();
	}

	async function request(url) {
		const res = await fetchImpl(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				"User-Agent": userAgent,
			},
		});
		if (!res.ok) {
			const body = (await res.text()).slice(0, 300);
			throw new CanvasError(res.status, res.statusText, body);
		}
		return res;
	}

	/** Fetches a single object. */
	async function getOne(path, params) {
		return (await request(buildUrl(path, params))).json();
	}

	/** Fetches a collection, following `Link: rel="next"` pagination up to MAX_PAGES. */
	async function getList(path, params = {}) {
		let url = buildUrl(path, { per_page: 100, ...params });
		const out = [];
		for (let page = 0; url && page < MAX_PAGES; page++) {
			const res = await request(url);
			out.push(...(await res.json()));
			const next = parseNextLink(res.headers.get("Link"));
			// Never follow a pagination link that points away from the configured Canvas host,
			// otherwise the bearer token could be sent to a third party.
			url = next && new URL(next).origin === origin ? next : undefined;
		}
		return out;
	}

	/**
	 * Downloads a file body from a Canvas file URL. Those URLs carry their own
	 * short-lived verifier, so the API token is deliberately not attached.
	 */
	async function download(url) {
		const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
		return res.ok ? res.text() : undefined;
	}

	/** Resolves a possibly relative Canvas link against the instance origin. */
	function resolve(href) {
		return href ? new URL(href, origin).toString() : undefined;
	}

	return { origin, buildUrl, getOne, getList, download, resolve };
}
