"use client";

import { Bookmark, BookmarkCheck, CircleCheck, ExternalLink, EyeOff, IndianRupee, MapPin, PenLine, ThumbsUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { FeedJob, JobStatus } from "@/lib/job-store";
import type { JobSource } from "@/lib/types";

const SOURCE_LABEL: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  naukri: "Naukri",
  glassdoor: "Glassdoor",
  foundit: "foundit",
  instahyre: "Instahyre",
  wellfound: "Wellfound",
  email: "Email",
  other: "Job alert",
};

export function scoreTone(score: number | undefined): string {
  if (score === undefined) return "bg-[#e9eef6] text-[#444746] dark:bg-zinc-800 dark:text-zinc-300";
  if (score >= 85) return "bg-[#c4eed0] text-[#0d652d] dark:bg-emerald-900/60 dark:text-emerald-200";
  if (score >= 60) return "bg-[#fef7e0] text-[#7a5c00] dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-[#fce8e6] text-[#a50e0e] dark:bg-red-950/60 dark:text-red-300";
}

/** "Prepare application" opens New application with this job's details filled in. */
export function prepareHref(job: FeedJob): string {
  const params = new URLSearchParams({ jobKey: job.key, role: job.title });
  if (job.company) params.set("company", job.company);
  const jd = [job.location && `Location: ${job.location}`, job.experience && `Experience: ${job.experience}`, job.salary && `Salary: ${job.salary}`, job.snippet, job.url && `Job link: ${job.url}`].filter(Boolean).join("\n");
  if (jd) params.set("jd", jd);
  return `/apply?${params}`;
}

interface Props {
  job: FeedJob;
  onStatus: (status: JobStatus) => void;
}

export function JobCard({ job, onStatus }: Props) {
  const saved = job.status === "saved";
  const applied = ["applied", "interviewing", "offer", "rejected"].includes(job.status);

  return (
    <li className="flex gap-4 rounded-2xl border border-[#dadce0] bg-white p-4 transition hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] dark:border-zinc-700 dark:bg-zinc-900">
      <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${scoreTone(job.score)}`} title="AI match score">
        <span className="text-lg font-semibold leading-none tabular-nums">{job.score ?? "–"}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">match</span>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-zinc-50">{job.title}</h3>
            {job.company && <span className="text-sm text-[#444746] dark:text-zinc-300">{job.company}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#5f6368] dark:text-zinc-400">
            <span className="font-medium">{SOURCE_LABEL[job.source]}</span>
            {job.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{job.location}</span>}
            {job.salary && <span className="inline-flex items-center gap-0.5"><IndianRupee className="h-3 w-3" />{job.salary}</span>}
            {job.experience && <span>{job.experience}</span>}
            {job.posted && <span>{job.posted}</span>}
          </div>
        </div>

        {job.snippet && <p className="line-clamp-2 text-sm text-[#444746] dark:text-zinc-300">{job.snippet}</p>}

        {(job.reasons?.length || job.concerns?.length) ? (
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {job.reasons?.map((r) => <li key={r} className="inline-flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[#137333] dark:bg-emerald-950/50 dark:text-emerald-300"><ThumbsUp className="h-3 w-3" />{r}</li>)}
            {job.concerns?.map((c) => <li key={c} className="inline-flex items-center gap-1 rounded-full bg-[#fef7e0] px-2 py-0.5 text-[#7a5c00] dark:bg-amber-950/40 dark:text-amber-300"><TriangleAlert className="h-3 w-3" />{c}</li>)}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-full bg-[#0b57d0] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0a4fbd]">
              <ExternalLink className="h-3.5 w-3.5" />Open job
            </a>
          )}
          <Link href={prepareHref(job)} className="inline-flex items-center gap-1.5 rounded-full border border-[#747775] px-3.5 py-1.5 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] dark:border-zinc-600 dark:text-blue-300">
            <PenLine className="h-3.5 w-3.5" />Prepare application
          </Link>
          <span className="flex-1" />
          {applied ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[#137333] dark:text-emerald-300"><CircleCheck className="h-4 w-4" />Applied</span>
          ) : (
            <>
              <IconAction label={saved ? "Saved" : "Save"} onClick={() => onStatus(saved ? "new" : "saved")} active={saved}>
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </IconAction>
              <IconAction label="Mark as applied" onClick={() => onStatus("applied")}><CircleCheck className="h-4 w-4" /></IconAction>
              <IconAction label="Hide" onClick={() => onStatus("hidden")}><EyeOff className="h-4 w-4" /></IconAction>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function IconAction({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/10 ${active ? "text-[#0b57d0] dark:text-blue-300" : "text-[#5f6368] dark:text-zinc-400"}`}>
      {children}
    </button>
  );
}
