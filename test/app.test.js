import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp, safeEqual } from "../src/app.js";
import { createCanvasClient } from "../src/canvas.js";

const SECRET = "test-secret-0123456789abcdef";

let server;
let base;
const canvasCalls = [];

before(async () => {
	const fetchImpl = async (url, init) => {
		canvasCalls.push({ url, method: init?.method ?? "GET" });
		return Response.json([{ id: 42, name: "Intro to Testing", course_code: "TST 101", term: { name: "Fall" } }]);
	};
	const canvas = createCanvasClient({ baseUrl: "https://canvas.example.edu", token: "t", userAgent: "test", fetchImpl });
	const app = createApp({ canvas, secret: SECRET, logger: { error() {} } });
	server = app.listen(0);
	await new Promise((resolve) => server.once("listening", resolve));
	base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

/** Sends one JSON-RPC message to the MCP endpoint and returns the parsed result. */
async function rpc(method, params = {}) {
	const res = await fetch(`${base}/${SECRET}/mcp`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	assert.equal(res.status, 200);
	const text = await res.text();
	const payload = text.startsWith("{") ? text : text.split("\n").find((l) => l.startsWith("data:")).slice(5);
	return JSON.parse(payload).result;
}

test("safeEqual compares by value", () => {
	assert.equal(safeEqual("abc", "abc"), true);
	assert.equal(safeEqual("abc", "abd"), false);
	assert.equal(safeEqual("abc", "abcd"), false);
});

test("health check responds without auth", async () => {
	const res = await fetch(`${base}/healthz`);
	assert.equal(res.status, 200);
	assert.equal(await res.text(), "ok");
});

test("wrong secret and unknown paths look identical", async () => {
	const wrong = await fetch(`${base}/not-the-secret/mcp`, { method: "POST" });
	const unknown = await fetch(`${base}/anything`);
	assert.equal(wrong.status, 404);
	assert.equal(unknown.status, 404);
	assert.equal(await wrong.text(), await unknown.text());
	assert.equal(wrong.headers.get("x-powered-by"), null);
});

test("initialize reports the server name", async () => {
	const result = await rpc("initialize", {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "test", version: "0" },
	});
	assert.equal(result.serverInfo.name, "Canvas (read-only)");
});

test("all 26 tools are registered and marked read-only", async () => {
	const { tools } = await rpc("tools/list");
	assert.equal(tools.length, 26);
	for (const tool of tools) {
		assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} should be read-only`);
		assert.ok(tool.description.length > 20, `${tool.name} needs a description`);
	}
});

test("tool calls reach Canvas with GET only", async () => {
	canvasCalls.length = 0;
	const result = await rpc("tools/call", { name: "list_courses", arguments: {} });
	assert.equal(result.isError, undefined);
	assert.deepEqual(JSON.parse(result.content[0].text), [{ id: 42, name: "Intro to Testing", code: "TST 101", term: "Fall" }]);
	assert.ok(canvasCalls.length > 0);
	assert.ok(canvasCalls.every((c) => c.method === "GET"));
});
