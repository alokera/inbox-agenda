import { decide, followUpsDue, startOfToday, type Triage } from "./autopilot";
import { addProcessedEmails, appendLog, loadLog, loadProcessedEmails, loadQueue, loadSettings, saveLastRun, saveQueue, type AutopilotRun, type LogEntry } from "./autopilot-store";
import { fetchJson } from "./client-api";
import { emptyPreferences, loadPreferences, markReplied, trackSentApplication } from "./job-store";
import { blobToBase64, loadProfile, loadResumes, loadSentApplications, loadTemplates, previousApplicationsTo, recordSentApplication, toResumeSummaries, updateSentApplications } from "./profile-store";
import { fillTemplate, templateValues } from "./templates";
import type { JobAnalysis } from "./types";
import { replySubject } from "./ui-format";

interface Candidate {
  id: string;
  threadId: string;
  from: string;
  subject: string;
}

interface TriageResult {
  emailId: string;
  ok: boolean;
  triage: Triage | null;
  alreadyRepliedInThread: boolean;
  replyTo: string;
  subject: string;
}

const MAX_ATTACH_BYTES = 3 * 1024 * 1024;
let running = false;

/**
 * One Autopilot pass, run in the browser: find recruiter/job emails, triage them,
 * auto-send or queue applications, detect replies, and prepare follow-ups.
 * Only one pass runs at a time.
 */
export async function runAutopilot(opts: { canSend: boolean; onStatus?: (message: string) => void }): Promise<AutopilotRun | null> {
  if (running) return null;
  running = true;
  const status = opts.onStatus ?? (() => {});
  const log: Omit<LogEntry, "id">[] = [];
  const run: AutopilotRun = { at: Date.now(), checked: 0, sent: 0, queued: 0, skipped: 0 };

  try {
    const settings = await loadSettings();
    if (settings.mode === "off") return null;
    const [profile, savedPrefs, resumes, processed, queue, templates] = await Promise.all([loadProfile(), loadPreferences(), loadResumes(), loadProcessedEmails(), loadQueue(), loadTemplates()]);
    if (!profile?.fullName) throw new Error("Set up your Job profile first.");
    const prefs = savedPrefs ?? emptyPreferences(profile);
    const pastLog = await loadLog();
    let sentToday = pastLog.filter((e) => e.action === "sent" && e.at >= startOfToday()).length;

    // 1. Find recruiter / job emails not seen before.
    status("Looking for recruiter and job emails…");
    const { candidates } = await fetchJson<{ candidates: Candidate[] }>("/api/autopilot/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: settings.lookbackDays, processedIds: [...processed, ...queue.map((q) => q.replyToEmailId)] }),
    });

    // 2. Quick AI triage, 10 at a time.
    const results: TriageResult[] = [];
    for (let i = 0; i < candidates.length; i += 10) {
      status(`Checking emails ${i + 1}–${Math.min(i + 10, candidates.length)} of ${candidates.length}…`);
      const { results: batch } = await fetchJson<{ results: TriageResult[] }>("/api/autopilot/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: candidates.slice(i, i + 10).map((c) => c.id), profile, preferences: prefs }),
      });
      results.push(...batch);
    }

    // 3. Decide, then write and send/queue the ones worth it.
    const newQueue = [...queue];
    const handled: string[] = [];
    const handleOne = async (result: TriageResult, t: Triage) => {
      run.checked++;
      const to = t.applyEmail ?? result.replyTo;
      const title = [t.role ?? result.subject, t.company].filter(Boolean).join(" · ");
      const history = await loadSentApplications();
      const decision = decide({
        triage: t,
        settings,
        alreadyApplied: previousApplicationsTo(history, to).length > 0 || newQueue.some((q) => q.to.toLowerCase() === to.toLowerCase()),
        alreadyRepliedInThread: result.alreadyRepliedInThread,
        sentToday,
        canSend: opts.canSend,
      });

      if (decision.action === "skip") {
        run.skipped++;
        log.push({ at: Date.now(), action: "skipped", title, detail: decision.reason, emailId: result.emailId });
        return;
      }

      status(`Writing application: ${title}…`);
      const { analysis } = await fetchJson<{ analysis: JobAnalysis }>("/api/applications/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: result.emailId, profile, resumes: toResumeSummaries(resumes) }),
      });
      const subject = to.toLowerCase() === result.replyTo.toLowerCase() && result.subject ? replySubject(result.subject) : analysis.subject;
      const resumeId = analysis.suggestedResumeId ?? resumes.find((r) => r.isDefault)?.id ?? "";

      if (decision.action === "auto-send") {
        const resume = resumes.find((r) => r.id === resumeId);
        const attachment = resume && resume.size <= MAX_ATTACH_BYTES ? { filename: resume.filename, base64: await blobToBase64(resume.file) } : null;
        const sent = await fetchJson<{ messageId: string; threadId: string }>("/api/applications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId: result.emailId, to, subject, body: analysis.body, fromName: profile.fullName, attachment }),
        });
        await recordSentApplication({ id: sent.messageId, to, subject, company: t.company, role: t.role, resumeLabel: attachment ? resume!.label : null, sentAt: Date.now(), messageId: sent.messageId, threadId: sent.threadId, auto: true });
        await trackSentApplication({ title: t.role ?? subject, company: t.company, to, messageId: sent.messageId, threadId: sent.threadId });
        sentToday++;
        run.sent++;
        log.push({ at: Date.now(), action: "sent", title, detail: `Sent to ${to} · ${decision.reason}`, emailId: result.emailId });
      } else {
        newQueue.unshift({ id: crypto.randomUUID(), kind: "application", createdAt: Date.now(), replyToEmailId: result.emailId, to, subject, body: analysis.body, resumeId, score: t.score, role: t.role, company: t.company, reason: decision.reason });
        run.queued++;
        log.push({ at: Date.now(), action: "queued", title, detail: decision.reason, emailId: result.emailId });
      }
    };

    for (const result of results) {
      if (!result.ok || !result.triage) continue; // retried next run
      try {
        await handleOne(result, result.triage);
        handled.push(result.emailId);
      } catch (error) {
        // Not marked as handled, so it's retried on the next run.
        log.push({ at: Date.now(), action: "error", title: result.subject || "Job email", detail: error instanceof Error ? error.message : "Failed", emailId: result.emailId });
      }
    }

    // 4. Replies to earlier applications.
    status("Checking for replies…");
    const history = await loadSentApplications();
    const awaiting = history.filter((h) => h.threadId && !h.repliedAt && h.sentAt > Date.now() - 60 * 86_400_000).slice(0, 100);
    if (awaiting.length) {
      const { replies } = await fetchJson<{ replies: { threadId: string; at: number; from: string }[] }>("/api/autopilot/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threads: awaiting.map((h) => ({ threadId: h.threadId, sentAt: h.sentAt })) }),
      });
      if (replies.length) {
        const at = new Map(replies.map((r) => [r.threadId, r.at]));
        await updateSentApplications((list) => list.map((h) => (at.has(h.threadId) && !h.repliedAt ? { ...h, repliedAt: at.get(h.threadId) } : h)));
        await markReplied(replies);
        for (const r of replies) log.push({ at: Date.now(), action: "replied", title: history.find((h) => h.threadId === r.threadId)?.role ?? "Application", detail: `Reply from ${r.from}` });
      }
    }

    // 5. Follow-ups for applications with no reply (always to the review queue).
    const due = followUpsDue((await loadSentApplications()).filter((h) => !h.isFollowUp), settings.followUpDays);
    const followUpTemplate = templates.find((tpl) => tpl.id === "follow-up") ?? templates.find((tpl) => /follow/i.test(tpl.name));
    if (due.length && followUpTemplate) {
      for (const h of due) {
        const values = templateValues(profile, { company: h.company ?? undefined, role: h.role ?? undefined });
        newQueue.unshift({
          id: crypto.randomUUID(),
          kind: "follow-up",
          createdAt: Date.now(),
          replyToEmailId: h.messageId,
          to: h.to,
          subject: replySubject(h.subject),
          body: fillTemplate(followUpTemplate.body, values),
          resumeId: resumes.find((r) => r.isDefault)?.id ?? "",
          score: null,
          role: h.role,
          company: h.company,
          reason: `No reply after ${settings.followUpDays} days`,
          followUpOf: h.id,
        });
        log.push({ at: Date.now(), action: "follow-up", title: [h.role, h.company].filter(Boolean).join(" · ") || h.subject, detail: `Follow-up prepared for ${h.to}` });
      }
      const dueIds = new Set(due.map((h) => h.id));
      await updateSentApplications((list) => list.map((h) => (dueIds.has(h.id) ? { ...h, followUpQueuedAt: Date.now() } : h)));
      run.queued += due.length;
    }

    await saveQueue(newQueue);
    await addProcessedEmails(handled);
    await saveLastRun(run);
    return run;
  } catch (error) {
    log.push({ at: Date.now(), action: "error", title: "Autopilot stopped", detail: error instanceof Error ? error.message : "Unknown error" });
    throw error;
  } finally {
    await appendLog(log);
    running = false;
  }
}
