import { Suspense } from "react";
import { AutopilotPage } from "@/components/autopilot/AutopilotPage";

export default function Page() {
  // The review-queue editor reads the URL (to return here after granting permission).
  return (
    <Suspense>
      <AutopilotPage />
    </Suspense>
  );
}
