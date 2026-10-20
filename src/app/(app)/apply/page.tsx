import { Suspense } from "react";
import { ComposeApplication } from "@/components/jobs/ComposeApplication";

// Client-gated by the (app) layout (not instant by design). The layout's `instant = false`
// only covers navigations into (app); sibling navigations are still validated, so opt out here too.
export const instant = false;

export default function Page() {
  // The editor reads the URL (to return here after granting permission), which needs Suspense.
  return (
    <Suspense>
      <ComposeApplication />
    </Suspense>
  );
}
