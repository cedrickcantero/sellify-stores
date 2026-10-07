import type { neonConfig as NeonConfig } from "@neondatabase/serverless";

// Optional: talk to a plain local Postgres through a WebSocket proxy instead
// of Neon. Set NEON_LOCAL_WS_PROXY to the proxy's host:port (for example
// "localhost:5488"). Unset in every deployed environment, where the Neon
// defaults apply.
export function configureNeonForLocalProxy(config: typeof NeonConfig): void {
  const proxy = process.env.NEON_LOCAL_WS_PROXY;
  if (!proxy) return;
  config.wsProxy = (host, port) => `${proxy}/v1?address=${host}:${port}`;
  config.useSecureWebSocket = false;
  config.pipelineTLS = false;
  config.pipelineConnect = false;
}
