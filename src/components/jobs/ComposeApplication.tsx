"use client";

import { ArrowLeft, ChevronDown, ExternalLink, LoaderCircle, MailCheck, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { loadProfile, loadResumes, loadSentApplications, toResumeSummaries, type SentApplication, type StoredResume } from "@/lib/profile-store";
import type { JobAnalysis, JobProfile } from "@/lib/types";
import { Skeleton } from "../ui/Skeleton";
import { useUser } from "../UserContext";
import { DraftEditor, type DraftValues } from "./DraftEditor";

interface Details {
  to: string;
  company: string;
  role: string;
  jobDescription: string;
}

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/**
 * Apply when all you have is an email address: type it (plus anything you know),
 * let AI write the email from your profile, then edit and send.
 */
export function ComposeApplication() {
  const user = useUser();
  const [profile, setProfile] = useState<JobProfile | null | undefined>(undefined);
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [history, setHistory] = useState<SentApplication[]>([]);
  const [details, setDetails] = useState<Details>({ to: "", company: "", role: "", jobDescription: "" });
  const [showMore, setShowMore] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [draft, setDraft] = useState<{ values: DraftValues; generation: number } | null>(null);

  useEffect(() => {
    Promise.all([loadProfile(), loadResumes(), loadSentApplications()]).then(([p, list, sent]) => {
      setProfile(p?.fullName ? p : null);
      setResumes(list);
      setHistory(sent);
    });
  }, []);

  const defaultResumeId = resumes.find((r) => r.isDefault)?.id ?? "";
  const validTo = EMAIL.test(details.to.trim());

  async function writeWithAI() {
    if (!profile) return;
    setWriting(true);
    setError(null);
    try {
      const { analysis: a } = await fetchJson<{ analysis: JobAnalysis }>("/api/applications/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...details, to: details.to.trim(), profile, resumes: toResumeSummaries(resumes) }),
      });
      setAnalysis(a);
      setDraft((d) => ({ generation: (d?.generation ?? 0) + 1, values: { to: details.to.trim(), subject: a.subject, body: a.body, resumeId: a.suggestedResumeId ?? defaultResumeId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write the application");
    } finally {
      setWriting(false);
    }
  }

  function writeMyself() {
    if (!profile) return;
    const role = details.role.trim();
    setAnalysis(null);
    setDraft((d) => ({
      generation: (d?.generation ?? 0) + 1,
      values: {
        to: details.to.trim(),
        subject: role ? `Application – ${role} – ${profile.fullName}` : `${profile.headline || "Job application"} – ${profile.fullName}`,
        body: `Hi,\n\n\n\n${[profile.portfolioUrl && `Portfolio: ${profile.portfolioUrl}`, profile.githubUrl && `GitHub: ${profile.githubUrl}`, profile.linkedinUrl && `LinkedIn: ${profile.linkedinUrl}`].filter(Boolean).join("\n")}\n\n${profile.signature || profile.fullName}`,
        resumeId: defaultResumeId,
      },
    }));
  }

  const input = "w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none placeholder:text-[#80868b] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8">
        <header className="space-y-1">
          <h1 className="text-[22px] text-[#1f1f1f] dark:text-zinc-50">New application</h1>
          <p className="text-sm text-[#5f6368] dark:text-zinc-400">Only have an email address? Enter it, add anything you know about the job, and let AI write the email from your profile, with your links and the right resume attached.</p>
        </header>

        {profile === undefined && <Skeleton className="h-40 rounded-2xl" />}

        {profile === null && (
          <div className="space-y-3 rounded-2xl bg-[#f2f6fc] p-5 text-sm text-[#444746] dark:bg-zinc-800/60 dark:text-zinc-300">
            <p>First, set up your job profile: links, a short summary, a signature and your resume PDFs. You only do this once.</p>
            <Link href="/profile" className="inline-flex rounded-full bg-[#0b57d0] px-5 py-2 font-medium text-white hover:bg-[#0a4fbd]">Set up job profile</Link>
          </div>
        )}

        {profile && !draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (validTo) void writeWithAI();
            }}
            className="space-y-4 rounded-2xl border border-[#dadce0] p-5 dark:border-zinc-700"
          >
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Recruiter or company email *</span>
              <input autoFocus type="email" className={input} placeholder="hr@company.com" value={details.to} onChange={(e) => setDetails({ ...details, to: e.target.value })} />
            </label>

            <button type="button" onClick={() => setShowMore((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-[#0b57d0] dark:text-blue-300">
              <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
              {showMore ? "Fewer details" : "Add company, role or job description (optional, makes it more tailored)"}
            </button>
            {showMore && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Company</span>
                    <input className={input} placeholder="Acme" value={details.company} onChange={(e) => setDetails({ ...details, company: e.target.value })} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Role</span>
                    <input className={input} placeholder="Frontend Developer" value={details.role} onChange={(e) => setDetails({ ...details, role: e.target.value })} />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Job description or notes</span>
                  <textarea className={`${input} min-h-32`} placeholder="Paste the job post, or notes like 'saw their hiring post on LinkedIn, React + Node role'" value={details.jobDescription} onChange={(e) => setDetails({ ...details, jobDescription: e.target.value })} />
                </label>
              </div>
            )}

            {error && <p className="text-sm text-[#c5221f]">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!validTo || writing} className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">
                {writing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {writing ? "Writing…" : "Write with AI"}
              </button>
              <button type="button" onClick={writeMyself} disabled={!validTo || writing} className="inline-flex items-center gap-2 rounded-full border border-[#747775] px-5 py-2.5 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] disabled:opacity-50 dark:border-zinc-600 dark:text-blue-300">
                <PenLine className="h-4 w-4" />Write it myself
              </button>
            </div>
          </form>
        )}

        {profile && draft && (
          <div className="space-y-4 rounded-2xl border border-[#dadce0] p-5 dark:border-zinc-700">
            <button type="button" onClick={() => setDraft(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0b57d0] dark:text-blue-300">
              <ArrowLeft className="h-4 w-4" />Change details
            </button>
            <DraftEditor
              key={draft.generation}
              initial={draft.values}
              profile={profile}
              resumes={resumes}
              analysis={analysis}
              onRegenerate={analysis ? writeWithAI : undefined}
            />
            {writing && <p className="flex items-center gap-2 text-sm text-[#444746]"><LoaderCircle className="h-4 w-4 animate-spin" />Writing a new version…</p>}
            {error && <p className="text-sm text-[#c5221f]">{error}</p>}
          </div>
        )}

        {history.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">Recently sent from InboxAgenda</h2>
            <ul className="divide-y divide-[#f1f3f4] rounded-2xl border border-[#dadce0] dark:divide-zinc-800 dark:border-zinc-700">
              {history.slice(0, 10).map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <MailCheck className="h-4 w-4 shrink-0 text-[#188038]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#1f1f1f] dark:text-zinc-100">{h.role ? `${h.role}${h.company ? ` · ${h.company}` : ""}` : h.subject}</p>
                    <p className="truncate text-xs text-[#5f6368] dark:text-zinc-400">{h.to} · {new Date(h.sentAt).toLocaleDateString([], { day: "numeric", month: "short" })}{h.resumeLabel ? ` · ${h.resumeLabel}` : ""}</p>
                  </div>
                  {h.messageId && (
                    <a href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(user.email)}#sent/${h.messageId}`} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-[#5f6368] hover:bg-black/[0.06] dark:hover:bg-white/10" aria-label="View in Gmail">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
