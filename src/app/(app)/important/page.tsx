import { Suspense } from "react";
import { MailSkeleton } from "@/components/mail/MailSkeleton";
import { MailView } from "@/components/mail/MailView";

export default function Page() {
  // MailView reads ?q, ?tab and ?id from the URL, which requires a Suspense boundary.
  return (
    <Suspense fallback={<MailSkeleton />}>
      <MailView view="important" />
    </Suspense>
  );
}
