import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, loadConfig } from "../src/config.js";

const valid = {
	CANVAS_BASE_URL: "https://canvas.example.edu/",
	CANVAS_API_TOKEN: "token",
	MCP_SECRET: "a".repeat(48),
};

test("accepts a valid environment and normalises the base URL", () => {
	assert.deepEqual(loadConfig(valid), {
		baseUrl: "https://canvas.example.edu",
		token: "token",
		secret: "a".repeat(48),
		port: 8080,
	});
});

test("honours PORT", () => {
	assert.equal(loadConfig({ ...valid, PORT: "3000" }).port, 3000);
});

test("reports every missing variable at once", () => {
	assert.throws(
		() => loadConfig({}),
		(err) =>
			err instanceof ConfigError &&
			/CANVAS_BASE_URL/.test(err.message) &&
			/CANVAS_API_TOKEN/.test(err.message) &&
			/MCP_SECRET/.test(err.message),
	);
});

test("rejects short or URL-unsafe secrets", () => {
	assert.throws(() => loadConfig({ ...valid, MCP_SECRET: "short" }), ConfigError);
	assert.throws(() => loadConfig({ ...valid, MCP_SECRET: `${"a".repeat(30)}/x` }), ConfigError);
});

test("rejects a base URL that is not http(s)", () => {
	assert.throws(() => loadConfig({ ...valid, CANVAS_BASE_URL: "canvas.example.edu" }), ConfigError);
});
