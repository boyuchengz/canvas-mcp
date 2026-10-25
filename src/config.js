const MIN_SECRET_LENGTH = 24;

export class ConfigError extends Error {}

/**
 * Reads and validates runtime configuration from environment variables.
 * Throws a ConfigError describing every problem at once, so a misconfigured
 * deployment fails fast with a single readable message.
 */
export function loadConfig(env = process.env) {
	const problems = [];

	const baseUrl = env.CANVAS_BASE_URL?.trim();
	if (!baseUrl) {
		problems.push("CANVAS_BASE_URL is required (e.g. https://canvas.instructure.com)");
	} else if (!/^https?:\/\//.test(baseUrl) || !URL.canParse(baseUrl)) {
		problems.push(`CANVAS_BASE_URL is not a valid http(s) URL: ${baseUrl}`);
	}

	const token = env.CANVAS_API_TOKEN?.trim();
	if (!token) problems.push("CANVAS_API_TOKEN is required");

	const secret = env.MCP_SECRET?.trim();
	if (!secret || secret.length < MIN_SECRET_LENGTH) {
		problems.push(`MCP_SECRET is required and must be at least ${MIN_SECRET_LENGTH} characters`);
	} else if (!/^[A-Za-z0-9_-]+$/.test(secret)) {
		problems.push("MCP_SECRET may only contain letters, digits, '-' and '_' (it is used as a URL path segment)");
	}

	const port = Number(env.PORT ?? 8080);
	if (!Number.isInteger(port) || port < 0 || port > 65535) problems.push(`PORT is not a valid port: ${env.PORT}`);

	if (problems.length) throw new ConfigError(problems.join("\n"));

	return { baseUrl: new URL(baseUrl).origin, token, secret, port };
}
