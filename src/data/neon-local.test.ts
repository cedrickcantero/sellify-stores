import { describe, expect, it } from "vitest";
import { configureNeonForLocalProxy } from "./neon-local";

type Config = Parameters<typeof configureNeonForLocalProxy>[0];

function freshConfig(): Config {
  return { useSecureWebSocket: true, pipelineTLS: true, pipelineConnect: "password" } as Config;
}

describe("configureNeonForLocalProxy", () => {
  it("routes the driver through the local proxy in development", () => {
    const config = freshConfig();
    configureNeonForLocalProxy(config, {
      NODE_ENV: "development",
      NEON_LOCAL_WS_PROXY: "127.0.0.1:5488",
    });

    expect(config.useSecureWebSocket).toBe(false);
    expect(typeof config.wsProxy === "function" && config.wsProxy("localhost", 5432)).toBe(
      "127.0.0.1:5488/v1?address=localhost:5432",
    );
  });

  it("leaves the Neon defaults alone when no proxy is configured", () => {
    const config = freshConfig();
    configureNeonForLocalProxy(config, { NODE_ENV: "development" });
    expect(config.useSecureWebSocket).toBe(true);
  });

  it("ignores the proxy setting on Vercel", () => {
    const config = freshConfig();
    configureNeonForLocalProxy(config, { VERCEL: "1", NEON_LOCAL_WS_PROXY: "127.0.0.1:5488" });
    expect(config.useSecureWebSocket).toBe(true);
  });

  it("ignores the proxy setting in production", () => {
    const config = freshConfig();
    configureNeonForLocalProxy(config, {
      NODE_ENV: "production",
      NEON_LOCAL_WS_PROXY: "127.0.0.1:5488",
    });
    expect(config.useSecureWebSocket).toBe(true);
  });
});
