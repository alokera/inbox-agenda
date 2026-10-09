"use client";

import { CircleCheck, Copy, ExternalLink, FileText, LoaderCircle, RotateCcw, Send, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { blobToBase64, loadSentApplications, previousApplicationsTo, recordSentApplication, type SentApplication, type StoredResume } from "@/lib/profile-store";
import type { JobAnalysis, JobProfile } from "@/lib/types";
import { useMailbox, useUser } from "../UserContext";

const MAX_ATTACH_BYTES = 3 * 1024 * 1024;

export interface DraftValues {
  to: string;
  subject: string;
  body: string;
  resumeId: string;
}

interface Props {
  initial: DraftValues;
  profile: JobProfile;
  resumes: StoredResume[];
  /** The AI's analysis, for the resume pick and to label the sent history. */
  analysis?: JobAnalysis | null;
  /** Set when replying to a job email, so the message goes into that thread. */
  replyToEmailId?: string;
  onRegenerate?: () => void;
}

interface Result {
  kind: "draft" | "send";
  messageId: string;
}

/**
 * Edit an application, then save it as a Gmail draft or send it (after confirmation).
 * Parents key this component by generation, so "Regenerate" starts from fresh values.
 */
export function DraftEditor({ initial, profile, resumes, analysis, replyToEmailId, onRegenerate }: Props) {
  const user = useUser();
  const { canDraft } = useMailbox();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<SentApplication[]>([]);

  useEffect(() => {
    loadSentApplications().then(setHistory).catch(() => {});
  }, []);

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const resume = resumes.find((r) => r.id === values.resumeId) ?? null;
  const resumeTooBig = Boolean(resume && resume.size > MAX_ATTACH_BYTES);
  const earlier = previousApplicationsTo(history, values.to);
  const ready = Boolean(values.to && values.subject && values.body) && !resumeTooBig;

  async function submit(kind: "draft" | "send") {
    setBusy(kind);
    setError(null);
    try {
      const attachment = resume && !resumeTooBig ? { filename: resume.filename, base64: await blobToBase64(resume.file) } : null;
      const payload = { ...values, emailId: replyToEmailId, fromName: profile.fullName, attachment };
      const data = await fetchJson<{ messageId: string; threadId?: string }>(`/api/applications/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (kind === "send") {
        await recordSentApplication({
          id: data.messageId || crypto.randomUUID(),
          to: values.to.trim(),
          subject: values.subject,
          company: analysis?.company ?? null,
          role: analysis?.role ?? null,
          resumeLabel: resume && !resumeTooBig ? resume.label : null,
          sentAt: Date.now(),
          messageId: data.messageId,
          threadId: data.threadId ?? "",
        });
      }
      setResult({ kind, messageId: data.messageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(`Subject: ${values.subject}\n\n${values.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const gmailBase = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(user.email)}`;
  const currentPage = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  const field = "w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  if (result) {
    const sent = result.kind === "send";
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#e6f4ea] p-4 text-sm text-[#137333] dark:bg-emerald-950/40 dark:text-emerald-300">
        <CircleCheck className="h-5 w-5" />
        <span className="flex-1">
          {sent ? `Sent to ${values.to}` : "Draft saved in Gmail. Review it there and press Send"}
          {resume && !resumeTooBig ? `, with ${resume.filename} attached` : ""}.
        </span>
        <a href={sent ? `${gmailBase}#sent/${result.messageId}` : `${gmailBase}#drafts?compose=${result.messageId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#137333] px-4 py-2 font-medium text-white hover:bg-[#0f5c29]">
          <ExternalLink className="h-4 w-4" />{sent ? "View in Gmail" : "Open draft"}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">To</span>
        <input className={field} type="email" value={values.to} onChange={(e) => set("to", e.target.value)} />
      </label>
      {earlier.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-[#fef7e0] px-3 py-2 text-xs text-[#7a5c00] dark:bg-amber-950/40 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You already emailed {values.to.trim()} on {new Date(earlier[0].sentAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
          {earlier[0].role ? ` about ${earlier[0].role}` : ""}{earlier.length > 1 ? ` (and ${earlier.length - 1} more time${earlier.length > 2 ? "s" : ""})` : ""}.
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Subject</span>
        <input className={field} value={values.subject} onChange={(e) => set("subject", e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Message</span>
        <textarea className={`${field} min-h-72 leading-6`} value={values.body} onChange={(e) => set("body", e.target.value)} />
      </label>

      <div className="space-y-1">
        <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Attach resume</span>
        {resumes.length === 0 ? (
          <p className="text-sm text-[#5f6368] dark:text-zinc-400">No resumes yet. <Link href="/profile" className="font-medium text-[#0b57d0] hover:underline">Upload one in Job profile</Link>.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-[#d93025]" />
              <select className={field} value={values.resumeId} onChange={(e) => set("resumeId", e.target.value)}>
                <option value="">Don&apos;t attach a resume</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}{r.id === analysis?.suggestedResumeId ? " (AI pick)" : ""}</option>
                ))}
              </select>
            </div>
            {analysis?.resumeReason && values.resumeId === analysis.suggestedResumeId && (
              <p className="flex items-start gap-1.5 text-xs text-[#5f6368] dark:text-zinc-400"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#0b57d0]" />{analysis.resumeReason}</p>
            )}
            {resumeTooBig && <p className="text-xs text-[#c5221f]">This PDF is over 3 MB and can&apos;t be attached. Compress it or pick another.</p>}
          </>
        )}
      </div>

      {canDraft ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" onClick={() => setConfirming(true)} disabled={!ready || busy !== null} className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">
            <Send className="h-4 w-4" />Send
          </button>
          <OutlineButton onClick={() => submit("draft")} disabled={!ready || busy !== null}>
            {busy === "draft" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Save as draft
          </OutlineButton>
          {onRegenerate && <OutlineButton onClick={onRegenerate} disabled={busy !== null}><RotateCcw className="h-4 w-4" />Regenerate</OutlineButton>}
          <OutlineButton onClick={copyText}>{copied ? <CircleCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</OutlineButton>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-white p-4 text-sm text-[#444746] dark:bg-zinc-900 dark:text-zinc-300">
          <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#188038]" />To send or save this from InboxAgenda, allow it to create drafts and send email. It only sends when you click Send and confirm.</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/auth/google?returnTo=${encodeURIComponent(currentPage)}`} className="inline-flex rounded-full bg-[#0b57d0] px-5 py-2 font-medium text-white hover:bg-[#0a4fbd]">Allow sending</a>
            <OutlineButton onClick={copyText}>{copied ? <CircleCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy text instead"}</OutlineButton>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[#c5221f]">{error}</p>}

      {confirming && (
        <ConfirmSend
          to={values.to.trim()}
          subject={values.subject}
          attachment={resume && !resumeTooBig ? resume.filename : null}
          duplicate={earlier.length > 0}
          sending={busy === "send"}
          onCancel={() => setConfirming(false)}
          onConfirm={() => submit("send")}
        />
      )}
    </div>
  );
}

function OutlineButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-full border border-[#747775] px-4 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] disabled:opacity-50 dark:border-zinc-600 dark:text-blue-300">
      {children}
    </button>
  );
}

interface ConfirmProps {
  to: string;
  subject: string;
  attachment: string | null;
  duplicate: boolean;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Last check before an email leaves: sending can't be undone. */
function ConfirmSend({ to, subject, attachment, duplicate, sending, onCancel, onConfirm }: ConfirmProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, sending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-send-title">
      <div className="w-full max-w-md space-y-4 rounded-[28px] bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 id="confirm-send-title" className="text-xl text-[#1f1f1f] dark:text-zinc-50">Send this application?</h2>
        <dl className="space-y-2 text-sm">
          <Row label="To" value={to} />
          <Row label="Subject" value={subject} />
          <Row label="Resume" value={attachment ?? "No attachment"} />
        </dl>
        {duplicate && <p className="rounded-lg bg-[#fef7e0] px-3 py-2 text-xs text-[#7a5c00] dark:bg-amber-950/40 dark:text-amber-300">You&apos;ve emailed this address before.</p>}
        <p className="text-xs text-[#5f6368] dark:text-zinc-400">It&apos;s sent from your Gmail account right away and can&apos;t be unsent.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={sending} className="rounded-full px-5 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.06] dark:text-blue-300">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={sending} autoFocus className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-6 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-60">
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-[#5f6368] dark:text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-words text-[#1f1f1f] dark:text-zinc-100">{value}</dd>
    </div>
  );
}
