import { createHash, timingSafeEqual } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools/index.js";
import { VERSION } from "./version.js";

/**
 * Constant-time string comparison. Both sides are hashed first so that
 * neither the content nor the length of the secret leaks through timing.
 */
export function safeEqual(a, b) {
	const digest = (s) => createHash("sha256").update(String(s)).digest();
	return timingSafeEqual(digest(a), digest(b));
}

export function createMcpServer(canvas) {
	const server = new McpServer({ name: "Canvas (read-only)", version: VERSION });
	registerTools(server, canvas);
	return server;
}

/**
 * HTTP app exposing the MCP endpoint at /<secret>/mcp.
 * Any other path, including a wrong secret, gets an indistinguishable 404.
 */
export function createApp({ canvas, secret, logger = console }) {
	const app = express();
	app.disable("x-powered-by");
	app.use(express.json({ limit: "4mb" }));

	app.all("/:secret/mcp", async (req, res) => {
		if (!safeEqual(req.params.secret, secret)) return res.status(404).send("Not found");

		// Stateless mode: a fresh server and transport per request, nothing kept between calls.
		const server = createMcpServer(canvas);
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
		res.on("close", () => {
			transport.close();
			server.close();
		});

		try {
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch (err) {
			logger.error("MCP request failed:", err);
			if (!res.headersSent) res.status(500).json({ error: "internal error" });
		}
	});

	// Liveness probe for hosting platforms; intentionally reveals nothing.
	app.get("/healthz", (_req, res) => res.status(200).send("ok"));

	app.use((_req, res) => res.status(404).send("Not found"));

	return app;
}
