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
};

export function Landing({ configured, error }: Props) {
  const ready = configured.google && configured.ai;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 p-6">
      <div className="space-y-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white">📅</span>
        <h1 className="text-4xl font-bold tracking-tight">Never miss an appointment hiding in your inbox.</h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          InboxAgenda reads your recent Gmail and your Google Calendar, uses AI to find meetings, interviews, bookings and
          appointments, and shows them as one agenda, including the ones <strong>missing from your calendar</strong>.
        </p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{ERRORS[error] ?? "Something went wrong."}</p>}

      {ready ? (
        <a
          href="/api/auth/google"
          className="inline-flex w-fit items-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 py-3 font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          <GoogleIcon />
          Sign in with Google
        </a>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Setup needed</p>
          <p className="mt-1">
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in{" "}
            {[!configured.google && "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET", !configured.ai && "XAI_API_KEY"].filter(Boolean).join(" and ")}
            , then restart the dev server. See the README for the Google Cloud steps.
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        <p className="font-semibold text-neutral-800 dark:text-neutral-200">🔒 How your data is handled</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Read-only</strong> access to Gmail and Calendar. InboxAgenda can&apos;t send, delete or change anything.</li>
          <li>Only recent emails that look like they mention a meeting or booking are analysed.</li>
          <li>Their text is sent to an AI provider (xAI Grok) to extract the details.</li>
          <li><strong>Nothing is stored</strong>: emails are read, analysed and discarded during each scan.</li>
          <li>Signing out revokes the app&apos;s access to your Google account.</li>
        </ul>
      </div>
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
