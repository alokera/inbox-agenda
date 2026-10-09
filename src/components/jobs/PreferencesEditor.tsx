"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { emptyPreferences, loadPreferences, savePreferences } from "@/lib/job-store";
import { loadProfile } from "@/lib/profile-store";
import type { JobPreferences } from "@/lib/types";

/** What the job feed scores against. Saved in this browser. */
export function PreferencesEditor() {
  const [prefs, setPrefs] = useState<JobPreferences | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    Promise.all([loadPreferences(), loadProfile()]).then(([saved, profile]) => setPrefs(saved ?? emptyPreferences(profile)));
  }, []);

  if (!prefs) return null;

  const update = <K extends keyof JobPreferences>(key: K, value: JobPreferences[K]) => {
    setPrefs({ ...prefs, [key]: value });
    setDirty(true);
  };

  async function save() {
    await savePreferences(prefs!);
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  const input = "w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none placeholder:text-[#80868b] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
  const field = (label: string, key: Exclude<keyof JobPreferences, "remoteOk">, placeholder: string) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">{label}</span>
      <input className={input} placeholder={placeholder} value={prefs[key]} onChange={(e) => update(key, e.target.value)} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("Target roles", "roles", "Full Stack Developer, Frontend Developer")}
        {field("Locations", "locations", "Pune, Bangalore, Mumbai")}
        {field("Years of experience", "experienceYears", "4")}
        {field("Minimum salary", "minSalary", "15 LPA")}
        {field("Skip jobs whose title contains", "skipKeywords", "intern, trainee, director, sales")}
        {field("Skip companies", "skipCompanies", "Company A, Company B")}
      </div>
      <label className="flex items-center gap-2 text-sm text-[#1f1f1f] dark:text-zinc-200">
        <input type="checkbox" checked={prefs.remoteOk} onChange={(e) => update("remoteOk", e.target.checked)} className="h-4 w-4 accent-[#0b57d0]" />
        Remote jobs are fine
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={!dirty} className="rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">Save preferences</button>
        {savedFlash && <span className="inline-flex items-center gap-1 text-sm text-[#188038]"><Check className="h-4 w-4" />Saved</span>}
        {dirty && !savedFlash && <span className="text-sm text-[#5f6368]">Unsaved changes</span>}
      </div>
    </div>
  );
}
