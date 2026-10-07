import type { neonConfig as NeonConfig } from "@neondatabase/serverless";

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
