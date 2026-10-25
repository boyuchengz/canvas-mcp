# Deployment

canvas-mcp is a plain Node.js HTTP server. Any host that runs Node.js 20+ and terminates HTTPS will work.

The server needs three environment variables (see [Configuration](../README.md#configuration)) and exposes two routes:

| Route | Purpose |
| --- | --- |
| `/<MCP_SECRET>/mcp` | MCP endpoint (Streamable HTTP, stateless) |
| `/healthz` | Health check, returns `200 ok` |

> **Always use HTTPS in production.** The secret is part of the URL path; over plain HTTP it is visible to anyone on the network.

## Railway

The repository includes a [`railway.json`](../railway.json) that sets the start command, health check and restart policy.

**From the CLI**

```bash
npm i -g @railway/cli
railway login
railway init        # create a project
railway up          # upload and deploy
```

**From GitHub**

1. Fork this repository.
2. In Railway, choose **New Project → Deploy from GitHub repo** and select your fork.

Then for either method:

1. Open the service's **Variables** tab and add `CANVAS_BASE_URL`, `CANVAS_API_TOKEN` and `MCP_SECRET`.
2. Under **Settings → Networking**, click **Generate Domain**.
3. Your connector URL is `https://<generated-domain>/<MCP_SECRET>/mcp`.

## Render

1. **New → Web Service**, connect your fork.
2. Build command `npm ci`, start command `npm start`.
3. Add the environment variables.
4. Set the health check path to `/healthz`.

Free instances sleep when idle; the first request after a pause can take several seconds, which some MCP clients may report as a timeout. Retry once, or use a paid instance.

## Fly.io

```bash
fly launch --no-deploy      # detects Node.js, generates fly.toml
fly secrets set CANVAS_BASE_URL=https://canvas.example.edu \
                CANVAS_API_TOKEN=... \
                MCP_SECRET=...
fly deploy
```

Make sure `internal_port` in `fly.toml` matches the port the app listens on (Fly sets `PORT` for you), and add an HTTP check against `/healthz` if you like.

## Your own server

```bash
git clone https://github.com/boyuchengz/canvas-mcp.git
cd canvas-mcp
npm ci --omit=dev
cp .env.example .env    # fill in values
node --env-file=.env src/server.js
```

Run it under a process manager (systemd, pm2) and put a reverse proxy with TLS in front of it. A minimal Caddy configuration:

```
canvas-mcp.example.com {
    reverse_proxy localhost:8080
}
```

If your proxy buffers responses, disable buffering for the MCP route so streamed responses are delivered promptly (for nginx, `proxy_buffering off;`).

## Local only

For clients on the same machine (e.g. Claude Code or Claude Desktop):

```bash
cp .env.example .env
npm run dev
```

The connector URL is `http://localhost:8080/<MCP_SECRET>/mcp`. Claude's web and mobile apps can't reach `localhost`; for those, deploy publicly or use a tunnel such as `cloudflared tunnel --url http://localhost:8080`.

## Rotating credentials

| What leaked | What to do |
| --- | --- |
| Connector URL | Set a new `MCP_SECRET`, redeploy, update the URL in your clients |
| Canvas token | Delete it in Canvas under **Account → Settings → Approved Integrations**, create a new one, update `CANVAS_API_TOKEN` |

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Service exits immediately with `invalid configuration` | A required variable is missing or malformed; the log lists which |
| Client says it can't connect / 404 | Wrong secret in the URL, or the path is missing `/mcp` |
| Every tool returns `Canvas API 401` | Token expired, was revoked, or `CANVAS_BASE_URL` points to the wrong instance |
| A specific tool returns `403` or `404` | That feature is disabled for students in the course (common for Files and Pages) |
| Results look incomplete | Lists are capped at 500 items per call; narrow the query (e.g. `bucket`, `search`, `course_id`) |
