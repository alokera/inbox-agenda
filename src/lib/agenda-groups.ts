import type { AgendaItem } from "./types";

export type GroupName = "Today" | "Tomorrow" | "This week" | "Later";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Buckets items by their start day, in the viewer's local timezone. */
export function groupAgenda(items: AgendaItem[], now: Date): { name: GroupName; items: AgendaItem[] }[] {
  const today = startOfDay(now);
  const day = 86_400_000;
  const groups: Record<GroupName, AgendaItem[]> = { Today: [], Tomorrow: [], "This week": [], Later: [] };
  for (const item of items) {
    const start = startOfDay(new Date(item.start));
    if (start <= today) groups.Today.push(item); // includes ongoing items that started earlier
    else if (start === today + day) groups.Tomorrow.push(item);
    else if (start < today + 7 * day) groups["This week"].push(item);
    else groups.Later.push(item);
  }
  return (Object.keys(groups) as GroupName[]).filter((name) => groups[name].length).map((name) => ({ name, items: groups[name] }));
}
