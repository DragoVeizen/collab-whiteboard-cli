import { describe, it, expect, beforeEach } from "vitest";
import { envOrDefault, DEFAULT_WS_PORT } from "./index.js";

const KEY = "__WHITEBOARD_M1_CANARY__";

describe("@whiteboard/server canary", () => {
  beforeEach(() => {
    delete process.env[KEY];
  });

  it("falls back when env var is unset", () => {
    expect(envOrDefault(KEY, "fb")).toBe("fb");
  });

  it("reads env var when set to a non-empty value", () => {
    process.env[KEY] = "set-value";
    expect(envOrDefault(KEY, "fb")).toBe("set-value");
  });

  it("falls back when env var is set but empty", () => {
    process.env[KEY] = "";
    expect(envOrDefault(KEY, "fb")).toBe("fb");
  });

  it("exposes DEFAULT_WS_PORT as a valid TCP port", () => {
    expect(DEFAULT_WS_PORT).toBeGreaterThan(1024);
    expect(DEFAULT_WS_PORT).toBeLessThan(65536);
  });
});
