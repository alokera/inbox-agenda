"use client";

import { Briefcase, Building, Clock, Link2, LoaderCircle, MapPin, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { loadProfile, loadResumes, toResumeSummaries, type StoredResume } from "@/lib/profile-store";
import { replySubject } from "@/lib/ui-format";
import type { JobAnalysis, JobProfile } from "@/lib/types";
import { DraftEditor, type DraftValues } from "./DraftEditor";

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
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [initial, setInitial] = useState<DraftValues>({ to: "", subject: "", body: "", resumeId: "" });
  // Bumped on every (re)generation so the editor starts from the new draft.
  const [generation, setGeneration] = useState(0);

  const analyze = useCallback(async (p: JobProfile, list: StoredResume[]) => {
    setStatus({ state: "analyzing" });
    try {
      const data = await fetchJson<AnalyzeResponse>("/api/applications/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, profile: p, resumes: toResumeSummaries(list) }),
      });
      const a = data.analysis;
      const recipient = a.applyMethod === "email" && a.applyEmail ? a.applyEmail : data.replyTo;
      setAnalysis(a);
      setInitial({
        to: recipient,
        // Replying to the sender keeps the thread's subject; a new address gets the AI's application subject.
        subject: recipient.toLowerCase() === data.replyTo.toLowerCase() && data.originalSubject ? replySubject(data.originalSubject) : a.subject,
        body: a.body,
        resumeId: a.suggestedResumeId ?? list.find((r) => r.isDefault)?.id ?? "",
      });
      setGeneration((g) => g + 1);
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

        {status.state === "ready" && analysis && profile && (
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

            <DraftEditor key={generation} initial={initial} profile={profile} resumes={resumes} analysis={analysis} replyToEmailId={emailId} onRegenerate={() => profile && analyze(profile, resumes)} />
          </>
        )}
      </div>
    </section>
  );
}
