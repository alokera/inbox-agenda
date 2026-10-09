"use client";

import { Briefcase, Building, CircleCheck, Clock, Copy, ExternalLink, FileText, Link2, LoaderCircle, MapPin, RotateCcw, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { blobToBase64, loadProfile, loadResumes, toResumeSummaries, type StoredResume } from "@/lib/profile-store";
import { replySubject } from "@/lib/ui-format";
import type { JobAnalysis, JobProfile } from "@/lib/types";
import { useMailbox, useUser } from "../UserContext";

const MAX_ATTACH_BYTES = 3 * 1024 * 1024;

interface AnalyzeResponse {
  analysis: JobAnalysis;
  replyTo: string;
  originalSubject: string;
}

type Status =
  | { state: "loading" }
  | { state: "no-profile" }
  | { state: "analyzing" }
  | { state: "error"; message: string }
  | { state: "ready" };

/**
 * Turns a job email into a ready-to-send application: AI analysis of the job,
 * a tailored reply from the user's profile, the best resume, and a Gmail draft.
 */
export function ApplicationPanel({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const user = useUser();
  const { canDraft } = useMailbox();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [resumeId, setResumeId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ messageId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const analyze = useCallback(async (p: JobProfile, list: StoredResume[]) => {
    setStatus({ state: "analyzing" });
    setDraft(null);
    setDraftError(null);
    try {
      const data = await fetchJson<AnalyzeResponse>("/api/applications/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, profile: p, resumes: toResumeSummaries(list) }),
      });
      const a = data.analysis;
      const recipient = a.applyMethod === "email" && a.applyEmail ? a.applyEmail : data.replyTo;
      setAnalysis(a);
      setTo(recipient);
      // Replying to the sender keeps the thread's subject; a new address gets the AI's application subject.
      setSubject(recipient.toLowerCase() === data.replyTo.toLowerCase() && data.originalSubject ? replySubject(data.originalSubject) : a.subject);
      setBody(a.body);
      setResumeId(a.suggestedResumeId ?? list.find((r) => r.isDefault)?.id ?? "");
      setStatus({ state: "ready" });
    } catch (err) {
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Couldn't draft the application" });
    }
  }, [emailId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadProfile(), loadResumes()]).then(([p, list]) => {
      if (cancelled) return;
      setResumes(list);
      if (!p?.fullName) return setStatus({ state: "no-profile" });
      setProfile(p);
      void analyze(p, list);
    });
    return () => {
      cancelled = true;
    };
  }, [analyze]);

  const resume = resumes.find((r) => r.id === resumeId) ?? null;
  const resumeTooBig = Boolean(resume && resume.size > MAX_ATTACH_BYTES);

  async function createGmailDraft() {
    setCreating(true);
    setDraftError(null);
    try {
      const attachment = resume && !resumeTooBig ? { filename: resume.filename, base64: await blobToBase64(resume.file) } : null;
      const result = await fetchJson<{ messageId: string }>("/api/applications/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, to, subject, body, fromName: profile?.fullName, attachment }),
      });
      setDraft(result);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Couldn't create the draft");
    } finally {
      setCreating(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const field = "w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
  // Re-runs Google sign-in to grant the draft permission, then returns to this email.
  const currentPage = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  const allowDraftsHref = `/api/auth/google?returnTo=${encodeURIComponent(currentPage)}`;
  const openDraftLink = draft ? `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(user.email)}#drafts?compose=${draft.messageId}` : "";

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#d3e3fd] bg-[#f8fafd] dark:border-blue-900/60 dark:bg-zinc-800/40">
      <header className="flex items-center gap-2 border-b border-[#d3e3fd] px-4 py-3 dark:border-blue-900/60">
        <Briefcase className="h-4 w-4 text-[#0b57d0] dark:text-blue-300" />
        <h2 className="flex-1 text-sm font-medium text-[#0b57d0] dark:text-blue-300">Job application assistant</h2>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#5f6368] hover:bg-black/[0.06] dark:hover:bg-white/10" aria-label="Close assistant">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-5 p-4">
        {(status.state === "loading" || status.state === "analyzing") && (
          <p className="flex items-center gap-2 py-6 text-sm text-[#444746] dark:text-zinc-300">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#0b57d0]" />
            {status.state === "loading" ? "Loading your job profile…" : "Reading the job email, picking your best resume and writing the application…"}
          </p>
        )}

        {status.state === "no-profile" && (
          <div className="space-y-3 py-2 text-sm text-[#444746] dark:text-zinc-300">
            <p>Set up your job profile first: your links, a short summary, a signature and your resume PDFs. You only do this once.</p>
            <Link href="/profile" className="inline-flex rounded-full bg-[#0b57d0] px-5 py-2 font-medium text-white hover:bg-[#0a4fbd]">Set up job profile</Link>
          </div>
        )}

        {status.state === "error" && (
          <div className="space-y-3">
            <p className="rounded-lg bg-[#fce8e6] px-3 py-2 text-sm text-[#c5221f] dark:bg-red-950/50 dark:text-red-300">{status.message}</p>
            {profile && <button type="button" onClick={() => analyze(profile, resumes)} className="text-sm font-medium text-[#0b57d0] hover:underline">Try again</button>}
          </div>
        )}

        {status.state === "ready" && analysis && (
          <>
            {/* What the AI understood about the job */}
            <div className="space-y-3 rounded-xl bg-white p-4 dark:bg-zinc-900">
              {!analysis.isJobOpportunity && (
                <p className="flex items-start gap-2 rounded-lg bg-[#fef7e0] px-3 py-2 text-xs text-[#7a5c00] dark:bg-amber-950/40 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />This doesn&apos;t look like a job opportunity, so the draft may not fit. Review it carefully.
                </p>
              )}
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-base font-medium text-[#1f1f1f] dark:text-zinc-50">{analysis.role ?? "Role not stated"}</p>
                {analysis.company && <p className="inline-flex items-center gap-1 text-sm text-[#444746] dark:text-zinc-300"><Building className="h-3.5 w-3.5" />{analysis.company}</p>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5f6368] dark:text-zinc-400">
                {analysis.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{analysis.location}</span>}
                {analysis.deadline && <span className="inline-flex items-center gap-1 font-medium text-[#c5221f]"><Clock className="h-3.5 w-3.5" />Apply by {analysis.deadline}</span>}
                <span>
                  How to apply:{" "}
                  {analysis.applyMethod === "reply" ? "reply to this email" : analysis.applyMethod === "email" ? `email ${analysis.applyEmail}` : analysis.applyMethod === "link" ? "on their website" : "not stated"}
                </span>
              </div>
              {analysis.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.skills.map((skill) => <span key={skill} className="rounded-full bg-[#e9eef6] px-2.5 py-0.5 text-xs text-[#1f1f1f] dark:bg-zinc-800 dark:text-zinc-200">{skill}</span>)}
                </div>
              )}
              {Object.values(analysis.asksFor).some(Boolean) && (
                <p className="text-xs text-[#5f6368] dark:text-zinc-400">
                  They asked for:{" "}
                  {(Object.entries(analysis.asksFor) as [keyof JobAnalysis["asksFor"], boolean][])
                    .filter(([, asked]) => asked)
                    .map(([key]) => ({ resume: "resume", portfolio: "portfolio", github: "GitHub", coverLetter: "cover letter" })[key])
                    .join(", ")}
                </p>
              )}
              {analysis.applyLink && (
                <a href={analysis.applyLink} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0b57d0] hover:underline dark:text-blue-300">
                  <Link2 className="h-4 w-4" />Open the application page
                </a>
              )}
            </div>

            {/* The draft */}
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">To</span>
                <input className={field} type="email" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Subject</span>
                <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Message</span>
                <textarea className={`${field} min-h-72 leading-6`} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>

              <div className="space-y-1">
                <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Attach resume</span>
                {resumes.length === 0 ? (
                  <p className="text-sm text-[#5f6368] dark:text-zinc-400">No resumes yet. <Link href="/profile" className="font-medium text-[#0b57d0] hover:underline">Upload one in Job profile</Link>.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 shrink-0 text-[#d93025]" />
                      <select className={field} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                        <option value="">Don&apos;t attach a resume</option>
                        {resumes.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}{r.id === analysis.suggestedResumeId ? " (AI pick)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    {analysis.resumeReason && resumeId === analysis.suggestedResumeId && (
                      <p className="flex items-start gap-1.5 text-xs text-[#5f6368] dark:text-zinc-400"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#0b57d0]" />{analysis.resumeReason}</p>
                    )}
                    {resumeTooBig && <p className="text-xs text-[#c5221f]">This PDF is over 3 MB and can&apos;t be attached. Compress it or pick another.</p>}
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            {draft ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#e6f4ea] p-4 text-sm text-[#137333] dark:bg-emerald-950/40 dark:text-emerald-300">
                <CircleCheck className="h-5 w-5" />
                <span className="flex-1">Draft saved in Gmail{resume && !resumeTooBig ? `, with ${resume.filename} attached` : ""}. Review it there and press Send.</span>
                <a href={openDraftLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#137333] px-4 py-2 font-medium text-white hover:bg-[#0f5c29]">
                  <ExternalLink className="h-4 w-4" />Open draft
                </a>
              </div>
            ) : canDraft ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={createGmailDraft} disabled={creating || !to || !subject || !body || resumeTooBig} className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">
                  {creating && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Create Gmail draft
                </button>
                <ActionButton onClick={() => profile && analyze(profile, resumes)} icon={RotateCcw}>Regenerate</ActionButton>
                <ActionButton onClick={copyText} icon={copied ? CircleCheck : Copy}>{copied ? "Copied" : "Copy text"}</ActionButton>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl bg-white p-4 text-sm text-[#444746] dark:bg-zinc-900 dark:text-zinc-300">
                <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#188038]" />To save this as a Gmail draft, allow InboxAgenda to create drafts. It never sends anything: you press Send in Gmail.</p>
                <div className="flex flex-wrap gap-2">
                  <a href={allowDraftsHref} className="inline-flex rounded-full bg-[#0b57d0] px-5 py-2 font-medium text-white hover:bg-[#0a4fbd]">Allow drafts</a>
                  <ActionButton onClick={copyText} icon={copied ? CircleCheck : Copy}>{copied ? "Copied" : "Copy text instead"}</ActionButton>
                </div>
              </div>
            )}
            {draftError && <p className="text-sm text-[#c5221f]">{draftError}</p>}
          </>
        )}
      </div>
    </section>
  );
}

function ActionButton({ onClick, icon: Icon, children }: { onClick: () => void; icon: typeof Copy; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-[#747775] px-4 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] dark:border-zinc-600 dark:text-blue-300">
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
