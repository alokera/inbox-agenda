import { describe, expect, it } from "vitest";
import { avatarColor, formatListDate, formatReaderDate, initials, recipientsLabel, shortNames, splitLinks, timeAgo } from "./ui-format";

describe("formatListDate", () => {
  const now = new Date(2026, 9, 9, 18, 0);
  it("shows the time for today", () => {
    expect(formatListDate(new Date(2026, 9, 9, 9, 5).toISOString(), now)).toMatch(/9:05/);
  });
  it("shows month and day earlier this year, and the year for older emails", () => {
    expect(formatListDate(new Date(2026, 2, 3).toISOString(), now)).not.toMatch(/2026/);
    expect(formatListDate(new Date(2024, 2, 3).toISOString(), now)).toMatch(/24/);
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

describe("timeAgo", () => {
  const now = new Date(2026, 9, 9, 18, 0);
  it("describes recent times", () => {
    expect(timeAgo(new Date(2026, 9, 9, 17, 59, 30), now)).toBe("just now");
    expect(timeAgo(new Date(2026, 9, 9, 17, 55), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date(2026, 9, 9, 16, 0), now)).toBe("2 hours ago");
    expect(timeAgo(new Date(2026, 9, 8, 18, 0), now)).toBe("1 day ago");
  });
  it("is empty for old or future dates", () => {
    expect(timeAgo(new Date(2026, 6, 1), now)).toBe("");
    expect(timeAgo(new Date(2026, 9, 10), now)).toBe("");
  });
  it("is appended to the reader date", () => {
    expect(formatReaderDate(new Date(2026, 9, 9, 16, 0).toISOString(), now)).toMatch(/\(2 hours ago\)$/);
  });
});

describe("shortNames", () => {
  it("shortens address lists to names", () => {
    expect(shortNames('"Rao, Asha" <asha@x.com>, rohan@y.com')).toBe("Rao, Asha, rohan");
    expect(shortNames("Team <team@x.com>")).toBe("Team");
    expect(shortNames("")).toBe("");
  });
});

describe("recipientsLabel", () => {
  it("shows the signed-in user as 'me', first", () => {
    expect(recipientsLabel('"Asha" <asha@x.com>, Me <Me@Gmail.com>', "me@gmail.com")).toBe("me, Asha");
    expect(recipientsLabel("me@gmail.com", "me@gmail.com")).toBe("me");
  });
  it("lists others by name when the user isn't a recipient", () => {
    expect(recipientsLabel("team@x.com", "me@gmail.com")).toBe("team");
  });
});
