import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("allows same-site paths", () => {
    expect(safeReturnTo("/inbox?id=18c2f0a1")).toBe("/inbox?id=18c2f0a1");
    expect(safeReturnTo("/jobs")).toBe("/jobs");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "/ok\r\nSet-Cookie: x", "", null, undefined]) {
      expect(safeReturnTo(bad)).toBeUndefined();
    }
  });
});
