import { describe, expect, it } from "vitest";
import { seal, unseal } from "./crypto";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("seal / unseal", () => {
  it("round-trips a payload", async () => {
    const token = await seal({ user: { email: "a@b.c" }, tokens: { accessToken: "ya29.x" } }, SECRET, 60);
    expect(token).not.toContain("ya29"); // encrypted, not just encoded
    expect(await unseal(token, SECRET)).toMatchObject({ user: { email: "a@b.c" }, tokens: { accessToken: "ya29.x" } });
  });

  it("rejects tampered tokens and the wrong secret", async () => {
    const token = await seal({ a: 1 }, SECRET, 60);
    const tampered = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(await unseal(tampered, SECRET)).toBeNull();
    expect(await unseal(token, `${SECRET}-different`)).toBeNull();
    expect(await unseal(undefined, SECRET)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await seal({ a: 1 }, SECRET, -1);
    expect(await unseal(token, SECRET)).toBeNull();
  });

  it("requires a long enough secret", async () => {
    await expect(seal({ a: 1 }, "short", 60)).rejects.toThrow(/32 characters/);
  });
});
