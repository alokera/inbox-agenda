import { Suspense } from "react";
import { MailSkeleton } from "@/components/mail/MailSkeleton";
import { MailView } from "@/components/mail/MailView";

// Client-gated by the (app) layout (not instant by design). The layout's `instant = false`
// only covers navigations into (app); sibling navigations are still validated, so opt out here too.
export const instant = false;

export default function Page() {
  // MailView reads ?q, ?tab and ?id from the URL, which requires a Suspense boundary.
  return (
    <Suspense fallback={<MailSkeleton />}>
      <MailView view="important" />
    </Suspense>
  );
}
