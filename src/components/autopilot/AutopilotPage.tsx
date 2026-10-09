"use client";

import { Ban, Bot, Check, CircleX, Eye, ListChecks, LoaderCircle, MessageSquareReply, Power, Reply, Send, ShieldCheck, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_AUTOPILOT, HARD_DAILY_CAP, normalizeSettings, startOfToday, type AutopilotMode, type AutopilotSettings } from "@/lib/autopilot";
import { addProcessedEmails, appendLog, loadLog, loadQueue, loadSettings, saveQueue, saveSettings, type LogEntry, type QueueItem } from "@/lib/autopilot-store";
import { loadProfile, loadResumes, type StoredResume } from "@/lib/profile-store";
import type { JobProfile } from "@/lib/types";
import { DraftEditor } from "../jobs/DraftEditor";
import { EmptyState } from "../ui/EmptyState";
import { useMailbox, useUser } from "../UserContext";
import { useAutopilot } from "./AutopilotProvider";

const MODES: { mode: AutopilotMode; title: string; text: string; icon: LucideIcon }[] = [
  { mode: "off", title: "Off", text: "Nothing runs.", icon: Power },
  { mode: "review", title: "Review", text: "Finds and writes applications; you approve each one.", icon: Eye },
  { mode: "auto", title: "Auto", text: "Sends strong matches automatically, within your daily limit.", icon: Zap },
];

export function AutopilotPage() {
  const user = useUser();
  const pathname = usePathname();
  const { canDraft } = useMailbox();
  const { running, status, error, lastRun, version, runNow } = useAutopilot();
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULT_AUTOPILOT);
  const [dirty, setDirty] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmAuto, setConfirmAuto] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), loadProfile(), loadResumes()]).then(([s, p, r]) => {
      setSettings(s);
      setProfile(p);
      setResumes(r);
    });
  }, []);

  // Reload queue and log after every run.
  useEffect(() => {
    Promise.all([loadQueue(), loadLog()]).then(([q, l]) => {
      setQueue(q);
      setLog(l);
    });
  }, [version]);

  async function setMode(mode: AutopilotMode) {
    if (mode === "auto" && settings.mode !== "auto") return setConfirmAuto(true);
    const next = { ...settings, mode };
    setSettings(next);
    await saveSettings(next);
  }

  async function enableAuto() {
    const next = { ...settings, mode: "auto" as const };
    setSettings(next);
    await saveSettings(next);
    setConfirmAuto(false);
  }

  async function saveNumbers() {
    const next = normalizeSettings(settings);
    setSettings(next);
    await saveSettings(next);
    setDirty(false);
  }

  async function removeFromQueue(id: string, logEntry?: Omit<LogEntry, "id">) {
    const current = await loadQueue();
    const item = current.find((q) => q.id === id);
    const next = current.filter((q) => q.id !== id);
    await saveQueue(next);
    // Sent or dismissed: never pick this email up again.
    if (item?.kind === "application") await addProcessedEmails([item.replyToEmailId]);
    if (logEntry) await appendLog([logEntry]);
    setQueue(next);
    setLog(await loadLog());
    setOpenId(null);
  }

  const sentToday = log.filter((e) => e.action === "sent" && e.at >= startOfToday()).length;
  const ready = Boolean(profile?.fullName);
  const num = (key: keyof AutopilotSettings, label: string, hint: string, max: number) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={settings[key] as number}
        onChange={(e) => {
          setSettings({ ...settings, [key]: Number(e.target.value) });
          setDirty(true);
        }}
        className="w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm outline-none focus:border-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950"
      />
      <span className="block text-[11px] text-[#5f6368] dark:text-zinc-400">{hint}</span>
    </label>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-8">
        <header className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-[22px] text-[#1f1f1f] dark:text-zinc-50"><Bot className="h-6 w-6 text-[#0b57d0]" />Autopilot</h1>
            <p className="text-sm text-[#5f6368] dark:text-zinc-400">Finds recruiter and job emails you can apply to by email, writes tailored applications, and sends or queues them. Runs hourly while InboxAgenda is open.</p>
          </div>
          <button type="button" onClick={() => runNow()} disabled={running || settings.mode === "off" || !ready} className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">
            {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {running ? "Running…" : "Run now"}
          </button>
        </header>

        {!ready && (
          <p className="rounded-xl bg-[#fef7e0] px-4 py-3 text-sm text-[#7a5c00] dark:bg-amber-950/40 dark:text-amber-300">
            Set up your <Link href="/profile" className="font-medium underline">Job profile</Link> first (details, experience, preferences and a resume). Autopilot writes applications from it.
          </p>
        )}
        {running && status && <p className="flex items-center gap-2 rounded-xl bg-[#f2f6fc] px-4 py-3 text-sm dark:bg-zinc-800/60"><LoaderCircle className="h-4 w-4 animate-spin text-[#0b57d0]" />{status}</p>}
        {error && <p className="rounded-xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/50 dark:text-red-300">{error}</p>}
        {lastRun && !running && (
          <p className="text-sm text-[#5f6368] dark:text-zinc-400">
            Last run {new Date(lastRun.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}: checked {lastRun.checked} · sent {lastRun.sent} · queued {lastRun.queued} · skipped {lastRun.skipped}. Sent today: {sentToday}/{settings.dailyCap}.
          </p>
        )}

        {/* Mode */}
        <section className="grid gap-3 sm:grid-cols-3">
          {MODES.map(({ mode, title, text, icon: Icon }) => {
            const active = settings.mode === mode;
            return (
              <button key={mode} type="button" onClick={() => setMode(mode)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#0b57d0] bg-[#d3e3fd]/50 ring-1 ring-[#0b57d0] dark:bg-blue-950/40" : "border-[#dadce0] hover:bg-black/[0.03] dark:border-zinc-700 dark:hover:bg-white/5"}`}>
                <span className="flex items-center gap-2 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100"><Icon className={`h-4 w-4 ${active ? "text-[#0b57d0]" : ""}`} />{title}{active && <Check className="ml-auto h-4 w-4 text-[#0b57d0]" />}</span>
                <span className="mt-1 block text-xs text-[#5f6368] dark:text-zinc-400">{text}</span>
              </button>
            );
          })}
        </section>

        {settings.mode !== "off" && !canDraft && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f2f6fc] px-4 py-3 text-sm dark:bg-zinc-800/60">
            <ShieldCheck className="h-4 w-4 text-[#188038]" />
            <span className="flex-1">To send applications (automatically or from the queue), allow InboxAgenda to send email.</span>
            <a href={`/api/auth/google?returnTo=${encodeURIComponent(pathname)}`} className="rounded-full bg-[#0b57d0] px-4 py-1.5 font-medium text-white hover:bg-[#0a4fbd]">Allow sending</a>
          </div>
        )}

        {/* Rules */}
        <section className="space-y-3 rounded-2xl border border-[#dadce0] p-5 dark:border-zinc-700">
          <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">Rules</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {num("autoSendScore", "Auto-send at match ≥", "Auto mode only. Default 85.", 100)}
            {num("queueScore", "Queue for review at match ≥", "Lower matches are skipped. Default 70.", 100)}
            {num("dailyCap", "Max automatic sends per day", `Protects your Gmail. Max ${HARD_DAILY_CAP}.`, HARD_DAILY_CAP)}
            {num("lookbackDays", "Look back (days)", "How far back to check emails.", 30)}
            {num("followUpDays", "Follow up after (days)", "No reply → follow-up in the queue. 0 = off.", 30)}
          </div>
          <p className="text-xs text-[#5f6368] dark:text-zinc-400">Always: never emails the same address twice, never applies where you already replied, and follow-ups always need your review.</p>
          <button type="button" onClick={saveNumbers} disabled={!dirty} className="rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">Save rules</button>
        </section>

        {/* Review queue */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-medium text-[#1f1f1f] dark:text-zinc-100"><ListChecks className="h-5 w-5" />Review queue <span className="text-sm font-normal text-[#5f6368]">({queue.length})</span></h2>
          {queue.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#c4c7c5] px-4 py-6 text-center text-sm text-[#5f6368] dark:border-zinc-700">Nothing waiting. Applications Autopilot prepares for you appear here.</p>
          ) : (
            <ul className="space-y-2">
              {queue.map((item) => {
                const open = openId === item.id;
                return (
                  <li key={item.id} className="rounded-2xl border border-[#dadce0] bg-white dark:border-zinc-700 dark:bg-zinc-900">
                    <button type="button" onClick={() => setOpenId(open ? null : item.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${item.kind === "follow-up" ? "bg-[#e9eef6] text-[#444746]" : "bg-[#d3e3fd] text-[#0b57d0]"}`}>{item.kind === "follow-up" ? "Follow-up" : item.score !== null ? `${item.score}% match` : "Application"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">{[item.role, item.company].filter(Boolean).join(" · ") || item.subject}</span>
                        <span className="block truncate text-xs text-[#5f6368] dark:text-zinc-400">{item.to} · {item.reason}</span>
                      </span>
                      <span className="text-xs text-[#5f6368]">{open ? "Close" : "Review"}</span>
                    </button>
                    {open && profile && (
                      <div className="space-y-3 border-t border-[#f1f3f4] p-4 dark:border-zinc-800">
                        <DraftEditor
                          initial={{ to: item.to, subject: item.subject, body: item.body, resumeId: item.resumeId }}
                          profile={profile}
                          resumes={resumes}
                          replyToEmailId={item.replyToEmailId}
                          isFollowUp={item.kind === "follow-up"}
                          trackAs={{ role: item.role ?? undefined, company: item.company ?? undefined }}
                          onSent={() => removeFromQueue(item.id, { at: Date.now(), action: "sent", title: [item.role, item.company].filter(Boolean).join(" · ") || item.subject, detail: `Sent to ${item.to} after review` })}
                        />
                        <button type="button" onClick={() => removeFromQueue(item.id, { at: Date.now(), action: "skipped", title: [item.role, item.company].filter(Boolean).join(" · ") || item.subject, detail: "Dismissed from the review queue" })} className="inline-flex items-center gap-1.5 text-sm text-[#5f6368] hover:text-[#c5221f]">
                          <Ban className="h-4 w-4" />Dismiss
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Activity log */}
        <section className="space-y-3">
          <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">Activity</h2>
          {log.length === 0 ? (
            <EmptyState icon={Bot} title="No activity yet" description="Turn on Review or Auto mode and click Run now." />
          ) : (
            <ul className="divide-y divide-[#f1f3f4] rounded-2xl border border-[#dadce0] dark:divide-zinc-800 dark:border-zinc-700">
              {log.slice(0, 60).map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <LogIcon action={entry.action} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[#1f1f1f] dark:text-zinc-100">{entry.title}</p>
                    <p className="truncate text-xs text-[#5f6368] dark:text-zinc-400">{entry.detail}</p>
                  </div>
                  {entry.emailId && (
                    <a href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(user.email)}#all/${entry.emailId}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-[#0b57d0] hover:underline dark:text-blue-300">Email</a>
                  )}
                  <time className="shrink-0 text-xs tabular-nums text-[#80868b]">{new Date(entry.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {confirmAuto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-[28px] bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="flex items-center gap-2 text-xl text-[#1f1f1f] dark:text-zinc-50"><Zap className="h-5 w-5 text-[#0b57d0]" />Turn on automatic sending?</h2>
            <ul className="space-y-1.5 text-sm text-[#444746] dark:text-zinc-300">
              <li>• Applications matching <strong>{settings.autoSendScore}%+</strong> are sent from your Gmail without asking.</li>
              <li>• At most <strong>{settings.dailyCap}</strong> per day; the rest go to the review queue.</li>
              <li>• Never twice to the same address; follow-ups always need review.</li>
              <li>• Every send is listed in Activity, and you can switch back anytime.</li>
            </ul>
            <p className="flex items-start gap-2 rounded-lg bg-[#fef7e0] px-3 py-2 text-xs text-[#7a5c00] dark:bg-amber-950/40 dark:text-amber-300"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />Tip: use Review mode for a few days first, to check the emails it writes.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAuto(false)} className="rounded-full px-5 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.06]">Cancel</button>
              <button type="button" onClick={enableAuto} className="rounded-full bg-[#0b57d0] px-6 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd]">Turn on Auto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogIcon({ action }: { action: LogEntry["action"] }) {
  const map: Record<LogEntry["action"], { icon: LucideIcon; className: string }> = {
    sent: { icon: Send, className: "text-[#188038]" },
    queued: { icon: ListChecks, className: "text-[#0b57d0]" },
    skipped: { icon: Ban, className: "text-[#80868b]" },
    error: { icon: CircleX, className: "text-[#c5221f]" },
    replied: { icon: MessageSquareReply, className: "text-[#8430ce]" },
    "follow-up": { icon: Reply, className: "text-[#e37400]" },
  };
  const { icon: Icon, className } = map[action];
  return <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />;
}
