import { createApp } from "./app.js";
import { createCanvasClient } from "./canvas.js";
import { ConfigError, loadConfig } from "./config.js";
import { VERSION } from "./version.js";

let config;
try {
	config = loadConfig();
} catch (err) {
	if (!(err instanceof ConfigError)) throw err;
	console.error(`canvas-mcp: invalid configuration\n${err.message}`);
	process.exit(1);
}

const canvas = createCanvasClient({
	baseUrl: config.baseUrl,
	token: config.token,
	userAgent: `canvas-mcp/${VERSION}`,
});

const server = createApp({ canvas, secret: config.secret }).listen(config.port, () => {
	console.log(`canvas-mcp ${VERSION} listening on :${config.port} (Canvas: ${config.baseUrl})`);
});

function shutdown(signal) {
	console.log(`canvas-mcp: received ${signal}, shutting down`);
	server.close(() => process.exit(0));
	// Don't let a lingering streaming connection block a redeploy.
	setTimeout(() => process.exit(0), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
