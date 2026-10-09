"use client";

import { Check, FileText, LoaderCircle, Lock, Trash, Upload, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { defaultSignature, emptyProfile, loadProfile, loadResumes, saveProfile, saveResumes, type StoredResume } from "@/lib/profile-store";
import type { JobProfile } from "@/lib/types";
import { useUser } from "../UserContext";

const MAX_RESUMES = 5;
const MAX_ATTACH_BYTES = 3 * 1024 * 1024;

export function JobProfileForm() {
  const user = useUser();
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [saved, setSaved] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadProfile(), loadResumes()]).then(([stored, storedResumes]) => {
      setProfile(stored ?? emptyProfile(user.name ?? "", user.email));
      setResumes(storedResumes);
    });
  }, [user.name, user.email]);

  if (!profile) return <div className="flex h-full items-center justify-center text-sm text-[#5f6368]"><LoaderCircle className="h-5 w-5 animate-spin" /></div>;

  function update<K extends keyof JobProfile>(key: K, value: JobProfile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    await saveProfile(profile);
    setSaved(true);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function persistResumes(next: StoredResume[]) {
    setResumes(next);
    await saveResumes(next);
    setResumes(await loadResumes()); // picks up the normalized default
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      const added: StoredResume[] = [];
      for (const file of Array.from(files).slice(0, MAX_RESUMES - resumes.length)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/resumes/extract", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(`${file.name}: ${data.error ?? "upload failed"}`);
        added.push({
          id: crypto.randomUUID(),
          label: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").slice(0, 60),
          filename: file.name,
          size: file.size,
          text: data.text,
          isDefault: false,
          addedAt: Date.now(),
          file,
        });
      }
      await persistResumes([...resumes, ...added]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const input = "w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition placeholder:text-[#80868b] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={save} className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-8">
        <header className="space-y-1">
          <h1 className="text-[22px] text-[#1f1f1f] dark:text-zinc-50">Job profile</h1>
          <p className="text-sm text-[#5f6368] dark:text-zinc-400">Set this up once. When you open a job email and click <strong>Draft application</strong>, AI writes a tailored reply from these details and attaches the right resume.</p>
          <p className="flex items-start gap-2 pt-2 text-xs text-[#5f6368] dark:text-zinc-400">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Saved only in this browser. When you draft an application, your profile and resume text are sent to xAI Grok to write it, and the chosen PDF is attached to the Gmail draft.
          </p>
        </header>

        <Section title="Your details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name *"><input required className={input} value={profile.fullName} onChange={(e) => update("fullName", e.target.value)} /></Field>
            <Field label="Headline"><input className={input} placeholder="Full-stack developer · Next.js, Node.js" value={profile.headline} onChange={(e) => update("headline", e.target.value)} /></Field>
            <Field label="Email"><input type="email" className={input} value={profile.email} onChange={(e) => update("email", e.target.value)} /></Field>
            <Field label="Phone"><input className={input} placeholder="+91 …" value={profile.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
            <Field label="Location"><input className={input} placeholder="Pune, India · open to remote" value={profile.location} onChange={(e) => update("location", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Links" hint="Added to every application, so you never paste them by hand again.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Portfolio"><input type="url" className={input} placeholder="https://…" value={profile.portfolioUrl} onChange={(e) => update("portfolioUrl", e.target.value)} /></Field>
            <Field label="GitHub"><input type="url" className={input} placeholder="https://github.com/…" value={profile.githubUrl} onChange={(e) => update("githubUrl", e.target.value)} /></Field>
            <Field label="LinkedIn"><input type="url" className={input} placeholder="https://linkedin.com/in/…" value={profile.linkedinUrl} onChange={(e) => update("linkedinUrl", e.target.value)} /></Field>
            <Field label="Other (blog, live demo…)"><input type="url" className={input} placeholder="https://…" value={profile.otherUrl} onChange={(e) => update("otherUrl", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="About you" hint="Experience, key skills and best projects, in your own words. The AI only uses facts written here and in your resumes; it won't invent anything.">
          <textarea
            className={`${input} min-h-36`}
            placeholder={"e.g. 2 years building web apps with React, Next.js and Node.js.\nProjects: DocuChat (RAG over PDFs), TaskForge (Redis job queue built from scratch), InboxAgenda (Gmail + AI).\nLooking for frontend or full-stack roles."}
            value={profile.summary}
            onChange={(e) => update("summary", e.target.value)}
          />
        </Section>

        <Section title="Signature">
          <textarea className={`${input} min-h-28 font-mono text-[13px]`} value={profile.signature} onChange={(e) => update("signature", e.target.value)} placeholder={defaultSignature(profile)} />
          <button type="button" onClick={() => update("signature", defaultSignature(profile))} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#0b57d0] hover:underline dark:text-blue-300">
            <WandSparkles className="h-4 w-4" />Generate from my details
          </button>
        </Section>

        <Section title="Tone">
          <div className="flex gap-2">
            {(["professional", "friendly"] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => update("tone", tone)}
                className={`rounded-lg border px-4 py-2 text-sm capitalize ${profile.tone === tone ? "border-[#0b57d0] bg-[#d3e3fd] font-medium text-[#001d35] dark:bg-blue-900/50 dark:text-blue-50" : "border-[#c4c7c5] text-[#444746] hover:bg-black/[0.04] dark:border-zinc-700 dark:text-zinc-300"}`}
              >
                {tone}
              </button>
            ))}
          </div>
        </Section>

        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-[#f1f3f4] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 dark:border-zinc-800 dark:bg-zinc-900/95">
          <button type="submit" disabled={saved} className="rounded-full bg-[#0b57d0] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">Save profile</button>
          {savedFlash && <span className="inline-flex items-center gap-1 text-sm text-[#188038]"><Check className="h-4 w-4" />Saved</span>}
          {!saved && <span className="text-sm text-[#5f6368]">Unsaved changes</span>}
        </div>

        <Section title="Resumes" hint="Upload different versions (e.g. Frontend, Full-stack). AI picks the best one for each job, and you can always switch it. Saved instantly.">
          <ul className="space-y-2">
            {resumes.map((resume) => (
              <li key={resume.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dadce0] p-3 dark:border-zinc-700">
                <FileText className="h-8 w-8 shrink-0 text-[#d93025]" />
                <div className="min-w-0 flex-1 space-y-1">
                  <input
                    aria-label="Resume label"
                    className="w-full rounded border border-transparent px-1 text-sm font-medium text-[#1f1f1f] hover:border-[#dadce0] focus:border-[#0b57d0] focus:outline-none dark:bg-transparent dark:text-zinc-100"
                    value={resume.label}
                    onChange={(e) => setResumes(resumes.map((r) => (r.id === resume.id ? { ...r, label: e.target.value } : r)))}
                    onBlur={() => persistResumes(resumes.map((r) => (r.id === resume.id ? { ...r, label: r.label.trim() || r.filename } : r)))}
                  />
                  <p className="px-1 text-xs text-[#5f6368] dark:text-zinc-400">
                    {resume.filename} · {(resume.size / 1024).toFixed(0)} KB
                    {resume.size > MAX_ATTACH_BYTES && <span className="text-[#c5221f]"> · too large to attach (max 3 MB)</span>}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#444746] dark:text-zinc-300">
                  <input type="radio" name="default-resume" checked={resume.isDefault} onChange={() => persistResumes(resumes.map((r) => ({ ...r, isDefault: r.id === resume.id })))} className="accent-[#0b57d0]" />
                  Default
                </label>
                <button type="button" onClick={() => persistResumes(resumes.filter((r) => r.id !== resume.id))} className="rounded-full p-2 text-[#5f6368] hover:bg-black/[0.06] dark:hover:bg-white/10" aria-label={`Delete ${resume.label}`}>
                  <Trash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {resumes.length < MAX_RESUMES && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#747775] px-5 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] disabled:opacity-60 dark:border-zinc-600 dark:text-blue-300"
            >
              {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Reading PDF…" : "Upload resume (PDF)"}
            </button>
          )}
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          {uploadError && <p className="mt-2 text-sm text-[#c5221f]">{uploadError}</p>}
        </Section>
      </form>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{title}</h2>
        {hint && <p className="text-xs text-[#5f6368] dark:text-zinc-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
