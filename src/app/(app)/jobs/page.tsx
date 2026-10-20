import { Suspense } from "react";
import { MailSkeleton } from "@/components/mail/MailSkeleton";
import { MailView } from "@/components/mail/MailView";

// Gmail search for recruiter messages, job posts and application instructions.
const JOB_QUERY =
  '(apply OR applying OR application OR hiring OR "job opportunity" OR opening OR position OR role OR recruiter OR resume OR CV OR "your profile" OR "we are looking for") newer_than:60d -category:promotions -category:social -in:sent';

// Client-gated by the (app) layout (not instant by design). The layout's `instant = false`
// only covers navigations into (app); sibling navigations are still validated, so opt out here too.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<MailSkeleton />}>
      <MailView view="all" preset={{ query: JOB_QUERY, label: "Job emails · last 60 days" }} />
    </Suspense>
  );
}
