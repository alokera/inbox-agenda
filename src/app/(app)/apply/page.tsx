import { Suspense } from "react";
import { ComposeApplication } from "@/components/jobs/ComposeApplication";

export default function Page() {
  // The editor reads the URL (to return here after granting permission), which needs Suspense.
  return (
    <Suspense>
      <ComposeApplication />
    </Suspense>
  );
}
