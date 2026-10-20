import { describe, expect, it, vi } from "vitest";
import { type RefreshResult, sharedRefresh } from "./token-refresh";

const result = (refreshToken: string): RefreshResult => ({
  accessToken: `access-for-${refreshToken}`,
  expiresAt: Date.now() + 3600_000,
  refreshToken,
});

/** Resolves only when told to, so we can hold several callers in flight at once. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("sharedRefresh", () => {
  it("runs one refresh for concurrent callers holding the same token and gives them all the same result", async () => {
    const gate = deferred<RefreshResult>();
    const doRefresh = vi.fn(() => gate.promise);

    // Three API routes refresh at once (e.g. /api/me, /api/labels, /api/emails).
    const callers = [sharedRefresh("RT1", doRefresh), sharedRefresh("RT1", doRefresh), sharedRefresh("RT1", doRefresh)];
    expect(doRefresh).toHaveBeenCalledTimes(1);

    gate.resolve(result("RT2")); // Google rotated RT1 -> RT2
    const settled = await Promise.all(callers);

    expect(doRefresh).toHaveBeenCalledTimes(1);
    for (const r of settled) expect(r.refreshToken).toBe("RT2");
  });

  it("reuses the cached result for a straggler that still holds the old token", async () => {
    const doRefresh = vi.fn(async () => result("rotated"));

    const first = await sharedRefresh("straggler-key", doRefresh);
    // A later request whose response hadn't delivered the new cookie yet still has the old token.
    const second = await sharedRefresh("straggler-key", doRefresh);

    expect(doRefresh).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("does not cache a failed refresh, so the next caller retries", async () => {
    const doRefresh = vi
      .fn<() => Promise<RefreshResult>>()
      .mockRejectedValueOnce(new Error("invalid_grant"))
      .mockResolvedValueOnce(result("recovered"));

    await expect(sharedRefresh("retry-key", doRefresh)).rejects.toThrow("invalid_grant");
    await expect(sharedRefresh("retry-key", doRefresh)).resolves.toMatchObject({ refreshToken: "recovered" });
    expect(doRefresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes independently for different tokens", async () => {
    const doRefresh = vi.fn(async () => result("x"));
    await Promise.all([sharedRefresh("token-a", doRefresh), sharedRefresh("token-b", doRefresh)]);
    expect(doRefresh).toHaveBeenCalledTimes(2);
  });
});
