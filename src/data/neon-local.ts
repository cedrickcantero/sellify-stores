import type { neonConfig as NeonConfig } from "@neondatabase/serverless";
import net from "node:net";
import ws from "ws";

// Driver setup shared by the app client and the maintenance helpers.
//
// The `ws` package is used instead of Node's built-in WebSocket (undici).
// When a connection fails, undici reports only an empty TypeError, which
// hides the cause; `ws` reports it (for example the HTTP status of a refused
// upgrade). Neon recommends `ws` for Node.
//
// Node's happy-eyeballs connect gives each address only 250ms by default and
// then gives up on it. From a machine far from the Neon region a TCP connect
// can take longer than that, which surfaced as intermittent ETIMEDOUT
// connection failures. 2s per attempt fixes it and changes nothing where
// latency is low (Vercel). The call is process-wide and idempotent.
const CONNECT_ATTEMPT_TIMEOUT_MS = 2000;

export function configureNeon(
  config: typeof NeonConfig,
  env: Record<string, string | undefined> = process.env,
): void {
  net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);
  config.webSocketConstructor = ws;
  configureNeonForLocalProxy(config, env);
}

// Optional, local only: talk to a plain local Postgres through the WebSocket
// proxy from `pnpm db:local-proxy` instead of Neon. Set NEON_LOCAL_WS_PROXY to
// the proxy's host:port (for example "127.0.0.1:5488"). The setting is
// ignored on Vercel and in production, so it can never downgrade a deployed
// connection to unencrypted WebSockets.
export function configureNeonForLocalProxy(
  config: typeof NeonConfig,
  env: Record<string, string | undefined> = process.env,
): void {
  const proxy = env.NEON_LOCAL_WS_PROXY;
  if (!proxy) return;
  if (env.VERCEL || env.NODE_ENV === "production") {
    console.warn("NEON_LOCAL_WS_PROXY is ignored on Vercel and in production.");
    return;
  }
  config.wsProxy = (host, port) => `${proxy}/v1?address=${host}:${port}`;
  config.useSecureWebSocket = false;
  config.pipelineTLS = false;
  config.pipelineConnect = false;
}
