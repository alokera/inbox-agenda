import { AgendaView } from "@/components/agenda/AgendaView";

// Client-gated by the (app) layout (not instant by design). The layout's `instant = false`
// only covers navigations into (app); sibling navigations are still validated, so opt out here too.
export const instant = false;

export default function Page() {
  return <AgendaView />;
}
