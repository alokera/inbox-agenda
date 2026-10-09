import { describe, expect, it } from "vitest";
import { avatarColor, formatListDate, initials, splitLinks } from "./ui-format";

describe("formatListDate", () => {
  const now = new Date(2026, 9, 9, 18, 0);
  it("shows the time for today", () => {
    expect(formatListDate(new Date(2026, 9, 9, 9, 5).toISOString(), now)).toMatch(/9:05/);
  });
  it("shows month and day earlier this year, and the year for older emails", () => {
    expect(formatListDate(new Date(2026, 2, 3).toISOString(), now)).not.toMatch(/2026/);
    expect(formatListDate(new Date(2024, 2, 3).toISOString(), now)).toMatch(/2024/);
  });
});

describe("initials", () => {
  it("uses first and last word", () => {
    expect(initials("Asha Rao")).toBe("AR");
    expect(initials("Mary Jane Watson")).toBe("MW");
  });
  it("handles single words, symbols and empty names", () => {
    expect(initials("amazon")).toBe("AM");
    expect(initials("\"HDFC Bank\"")).toBe("HB");
    expect(initials("")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("is stable for the same sender", () => {
    expect(avatarColor("a@b.com")).toBe(avatarColor("a@b.com"));
  });
});

describe("splitLinks", () => {
  it("separates links from text and drops trailing punctuation", () => {
    expect(splitLinks("Join at https://meet.google.com/abc-defg-hij. See you!")).toEqual([
      { type: "text", value: "Join at " },
      { type: "link", value: "https://meet.google.com/abc-defg-hij" },
      { type: "text", value: ". See you!" },
    ]);
  });
  it("never turns javascript: or other schemes into links", () => {
    expect(splitLinks("javascript:alert(1) mailto:a@b.c").every((s) => s.type === "text")).toBe(true);
  });
  it("returns plain text unchanged", () => {
    expect(splitLinks("no links here")).toEqual([{ type: "text", value: "no links here" }]);
  });
});
