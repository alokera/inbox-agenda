import { describe, expect, it } from "vitest";
import { groupAgenda } from "./agenda-groups";
import type { AgendaItem } from "./types";

const at = (start: string) => ({ id: start, start }) as AgendaItem;

describe("groupAgenda", () => {
  it("buckets by local day", () => {
    const now = new Date(2026, 9, 9, 9, 0); // Fri 9 Oct 2026, 09:00 local
    const groups = groupAgenda([at(new Date(2026, 9, 9, 15).toISOString()), at(new Date(2026, 9, 10, 10).toISOString()), at(new Date(2026, 9, 13, 10).toISOString()), at(new Date(2026, 10, 1, 10).toISOString())], now);
    expect(groups.map((g) => [g.name, g.items.length])).toEqual([["Today", 1], ["Tomorrow", 1], ["This week", 1], ["Later", 1]]);
  });

  it("omits empty groups", () => {
    expect(groupAgenda([], new Date())).toEqual([]);
  });
});
