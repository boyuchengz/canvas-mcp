import assert from "node:assert/strict";
import { test } from "node:test";
import { CanvasError, MAX_PAGES, createCanvasClient, parseNextLink } from "../src/canvas.js";

const BASE = "https://canvas.example.edu";

/** Builds a fake fetch that serves queued responses and records every call. */
function fakeFetch(responses) {
	const calls = [];
	const impl = async (url, init) => {
		calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {} });
		const next = responses.shift() ?? { body: [] };
		return new Response(typeof next.body === "string" ? next.body : JSON.stringify(next.body), {
			status: next.status ?? 200,
			headers: next.headers ?? {},
		});
	};
	return { impl, calls };
}

function client(fetchImpl) {
	return createCanvasClient({ baseUrl: BASE, token: "tkn", userAgent: "test", fetchImpl });
}

test("buildUrl encodes scalar and array params and skips undefined", () => {
	const url = new URL(client().buildUrl("/courses", { "include[]": ["term", "total_scores"], per_page: 10, x: undefined }));
	assert.equal(url.origin + url.pathname, `${BASE}/api/v1/courses`);
	assert.deepEqual(url.searchParams.getAll("include[]"), ["term", "total_scores"]);
	assert.equal(url.searchParams.get("per_page"), "10");
	assert.equal(url.searchParams.has("x"), false);
});

test("parseNextLink finds the next relation", () => {
	const header = '<https://a/x?page=1>; rel="current", <https://a/x?page=2>; rel="next", <https://a/x?page=9>; rel="last"';
	assert.equal(parseNextLink(header), "https://a/x?page=2");
	assert.equal(parseNextLink(null), undefined);
});

test("getOne sends the bearer token and only issues GET requests", async () => {
	const { impl, calls } = fakeFetch([{ body: { id: 1 } }]);
	assert.deepEqual(await client(impl).getOne("/courses/1"), { id: 1 });
	assert.equal(calls[0].headers.Authorization, "Bearer tkn");
	assert.equal(calls[0].method, "GET");
});

test("getList follows same-origin pagination", async () => {
	const { impl, calls } = fakeFetch([
		{ body: [1, 2], headers: { Link: `<${BASE}/api/v1/courses?page=2>; rel="next"` } },
		{ body: [3] },
	]);
	assert.deepEqual(await client(impl).getList("/courses"), [1, 2, 3]);
	assert.equal(calls.length, 2);
});

test("getList refuses to follow pagination to another host", async () => {
	const { impl, calls } = fakeFetch([
		{ body: [1], headers: { Link: '<https://evil.example.com/steal>; rel="next"' } },
	]);
	assert.deepEqual(await client(impl).getList("/courses"), [1]);
	assert.equal(calls.length, 1);
});

test("getList stops after MAX_PAGES pages", async () => {
	const page = { body: [0], headers: { Link: `<${BASE}/api/v1/x?page=n>; rel="next"` } };
	const { impl, calls } = fakeFetch(Array.from({ length: MAX_PAGES + 3 }, () => ({ ...page })));
	await client(impl).getList("/x");
	assert.equal(calls.length, MAX_PAGES);
});

test("non-2xx responses become CanvasError with status", async () => {
	const { impl } = fakeFetch([{ status: 401, body: '{"errors":[{"message":"Invalid access token."}]}' }]);
	await assert.rejects(client(impl).getOne("/courses"), (err) => err instanceof CanvasError && err.status === 401);
});

test("download never sends the API token", async () => {
	const { impl, calls } = fakeFetch([{ body: "file body" }]);
	assert.equal(await client(impl).download("https://files.example.com/f?verifier=abc"), "file body");
	assert.equal(calls[0].headers.Authorization, undefined);
});

test("resolve makes relative links absolute", () => {
	assert.equal(client().resolve("/courses/1/assignments/2"), `${BASE}/courses/1/assignments/2`);
	assert.equal(client().resolve(undefined), undefined);
});
