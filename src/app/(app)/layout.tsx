import { AppShell } from "@/components/AppShell";

// The signed-in area is gated client-side (it waits for /api/me before rendering pages),
// so navigations into it aren't instant by design. Opt out of instant-navigation validation.
export const instant = false;

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
