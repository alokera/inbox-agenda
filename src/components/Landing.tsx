import { Bookmark, CalendarDays, Lock, Mail, ShieldCheck, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";

interface Props {
  configured: { google: boolean; ai: boolean };
  error: string | null;
}

const ERRORS: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in.",
  missing_scopes: "InboxAgenda needs both Gmail and Calendar read access. Please sign in again and keep both boxes ticked.",
  invalid_state: "The sign-in link expired or was tampered with. Please try again.",
  oauth_failed: "Google sign-in failed. Please try again.",
  not_configured: "Google sign-in isn't configured on the server yet.",
  no_email: "Your Google account didn't share an email address.",
  session_expired: "Your Google session expired. Please sign in again.",
};

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Sparkles, title: "AI finds appointments", text: "Meetings, interviews, bookings and doctor visits, pulled out of everyday emails." },
  { icon: TriangleAlert, title: "Spots what's missing", text: "Highlights appointments that never made it into your calendar." },
  { icon: Bookmark, title: "Important mail first", text: "Your inbox, with the emails Gmail ranks as important a click away." },
];

export function Landing({ configured, error }: Props) {
  const ready = configured.google && configured.ai;
  const missing = [!configured.google && "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET", !configured.ai && "XAI_API_KEY"].filter(Boolean).join(" and ");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[60rem] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-900/20" aria-hidden />

      <header className="relative mx-auto flex w-full max-w-6xl items-center gap-2.5 px-6 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"><CalendarDays className="h-4 w-4" /></span>
        <span className="font-semibold tracking-tight">InboxAgenda</span>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-16 pt-6 lg:grid-cols-2">
        <div className="space-y-8">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />AI for your inbox and calendar
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              Never miss an appointment <span className="text-indigo-600 dark:text-indigo-400">hiding in your inbox.</span>
            </h1>
            <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
              Sign in with Google to see your important email and a single agenda of everything you&apos;ve got coming up,
              including what&apos;s missing from your calendar.
            </p>
          </div>

          {error && <p className="max-w-xl rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900">{ERRORS[error] ?? "Something went wrong."}</p>}

          {ready ? (
            <a href="/api/auth/google" className="inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700">
              <GoogleIcon />
              Continue with Google
            </a>
          ) : (
            <div className="max-w-xl rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
              <p className="font-semibold">Setup needed</p>
              <p className="mt-1">Add {missing} to <code>.env.local</code> (see <code>.env.example</code> and the README), then restart the dev server.</p>
            </div>
          )}

          <ul className="grid max-w-xl gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="space-y-1.5">
                <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
                <p className="text-xs leading-relaxed text-zinc-500">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <Preview />
          <div className="rounded-2xl bg-white/80 p-5 text-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/80 dark:ring-zinc-800">
            <p className="mb-3 flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100"><ShieldCheck className="h-4 w-4 text-emerald-600" />Your data</p>
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
              <Privacy icon={Lock}><strong className="font-medium text-zinc-800 dark:text-zinc-200">Read-only.</strong> InboxAgenda can&apos;t send, delete or change anything.</Privacy>
              <Privacy icon={Mail}>Emails are shown straight from Gmail. <strong className="font-medium text-zinc-800 dark:text-zinc-200">Nothing is stored.</strong></Privacy>
              <Privacy icon={Sparkles}>When scanning, likely appointment emails are sent to xAI Grok to extract the details.</Privacy>
              <Privacy icon={ShieldCheck}>Signing out revokes the app&apos;s access to your Google account.</Privacy>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function Privacy({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" /><span>{children}</span></li>
  );
}

/** Static illustration of the agenda, so visitors see what they'll get. */
function Preview() {
  const rows = [
    { time: "10:00", title: "Product sync", meta: "Google Calendar", accent: "bg-indigo-500" },
    { time: "16:00", title: "Dentist – Dr. Rao", meta: "Found in email", accent: "bg-amber-400", missing: true },
    { time: "19:30", title: "Dinner reservation, Olive", meta: "Found in email", accent: "bg-emerald-500" },
  ];
  return (
    <div className="rounded-2xl bg-white p-5 shadow-xl shadow-zinc-200/60 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:shadow-none dark:ring-zinc-800" aria-hidden>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Today</p>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.title} className="flex overflow-hidden rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800">
            <span className={`w-1 ${row.accent}`} />
            <div className="flex flex-1 items-center gap-4 px-4 py-3">
              <span className="w-12 text-sm font-semibold tabular-nums">{row.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.title}</p>
                <p className="text-xs text-zinc-500">{row.meta}</p>
              </div>
              {row.missing && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900">Not in calendar</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
