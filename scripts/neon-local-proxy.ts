// A minimal WebSocket-to-TCP proxy so the Neon serverless driver can talk to
// a plain local Postgres (for offline development and tests). It does what
// Neon's wsproxy does: every connection names its target with
// ?address=host:port and bytes are piped both ways.
//
// Usage: NEON_LOCAL_WS_PROXY_PORT=5488 pnpm db:local-proxy
// Then set NEON_LOCAL_WS_PROXY=localhost:5488 for the app and tests.
import net from "node:net";
import { WebSocketServer } from "ws";

const port = Number(process.env.NEON_LOCAL_WS_PROXY_PORT ?? 5488);
const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);

// Bound to the loopback interface only, so nothing else on the network can
// use it to reach the local database.
const server = new WebSocketServer({ host: "127.0.0.1", port });

server.on("connection", (socket, request) => {
  const address = new URL(request.url ?? "/", "http://proxy").searchParams.get("address") ?? "";
  const separator = address.lastIndexOf(":");
  const host = address.slice(0, separator);
  const targetPort = Number(address.slice(separator + 1));
  if (!allowedHosts.has(host) || !targetPort) {
    socket.close(1008, "Only local Postgres targets are allowed");
    return;
  }

  const tcp = net.connect({ host, port: targetPort });
  tcp.on("data", (chunk) => socket.send(chunk));
  tcp.on("close", () => socket.close());
  tcp.on("error", () => socket.close());
  socket.on("message", (data) => tcp.write(data as Buffer));
  socket.on("close", () => tcp.end());
});

console.log(`Neon local WebSocket proxy listening on ws://127.0.0.1:${port}/v1`);
