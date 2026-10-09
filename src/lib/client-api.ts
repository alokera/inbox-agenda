/**
 * Sends the user back to the sign-in page with a full page load (not client-side
 * navigation), so no data from the expired session stays in memory.
 */
export function redirectToSignIn(): void {
  window.location.replace(`${window.location.origin}/?error=session_expired`);
}

/** Fetch JSON from our API; on an expired Google session, send the user back to sign in. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.signInAgain) {
    redirectToSignIn();
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
