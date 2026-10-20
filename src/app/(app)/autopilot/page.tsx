import { Suspense } from "react";
import { AutopilotPage } from "@/components/autopilot/AutopilotPage";

// Client-gated by the (app) layout (not instant by design). The layout's `instant = false`
// only covers navigations into (app); sibling navigations are still validated, so opt out here too.
export const instant = false;

export default function Page() {
  // The review-queue editor reads the URL (to return here after granting permission).
  return (
    <Suspense>
      <AutopilotPage />
    </Suspense>
  );
}
