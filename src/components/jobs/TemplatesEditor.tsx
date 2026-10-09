"use client";

import { Check, Plus, RotateCcw, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { loadTemplates, saveTemplates } from "@/lib/profile-store";
import { DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, type EmailTemplate } from "@/lib/templates";

/** Edit the templates used by "Write it myself". Saved in this browser. */
export function TemplatesEditor() {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, []);

  if (!templates) return null;

  function change(id: string, patch: Partial<EmailTemplate>) {
    setTemplates((list) => list?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? null);
    setDirty(true);
  }

  async function persist(next: EmailTemplate[]) {
    setTemplates(next);
    await saveTemplates(next);
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function add() {
    const id = crypto.randomUUID();
    const next = [...templates!, { id, name: "My template", subject: "Application – {{role|Developer role}} – {{name}}", body: "Hi,\n\n\n\n{{links}}\n\n{{signature}}" }];
    setTemplates(next);
    setOpenId(id);
    setDirty(true);
  }

  const input = "w-full rounded-lg border border-[#c4c7c5] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#5f6368] dark:text-zinc-400">
        Fill-ins:{" "}
        {TEMPLATE_VARIABLES.map((v) => <code key={v} className="mr-1 rounded bg-[#e9eef6] px-1 py-0.5 text-[11px] text-[#1f1f1f] dark:bg-zinc-800 dark:text-zinc-200">{`{{${v}}}`}</code>)}
        <br />
        Add a fallback with <code className="rounded bg-[#e9eef6] px-1 text-[11px] dark:bg-zinc-800">{"{{role|a developer role}}"}</code>. A line whose fill-in is empty and has no fallback is left out. Text in <code className="rounded bg-[#e9eef6] px-1 text-[11px] dark:bg-zinc-800">[brackets]</code> marks something to personalise; you&apos;ll be warned if it&apos;s still there when you send.
      </p>

      <ul className="space-y-2">
        {templates.map((t) => {
          const open = openId === t.id;
          return (
            <li key={t.id} className="rounded-xl border border-[#dadce0] dark:border-zinc-700">
              <button type="button" onClick={() => setOpenId(open ? null : t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="flex-1 truncate text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">{t.name}</span>
                <span className="hidden max-w-[50%] truncate text-xs text-[#5f6368] sm:inline dark:text-zinc-400">{t.subject}</span>
              </button>
              {open && (
                <div className="space-y-3 border-t border-[#f1f3f4] p-4 dark:border-zinc-800">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Name</span>
                    <input className={input} value={t.name} onChange={(e) => change(t.id, { name: e.target.value })} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Subject</span>
                    <input className={input} value={t.subject} onChange={(e) => change(t.id, { subject: e.target.value })} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#444746] dark:text-zinc-300">Message</span>
                    <textarea className={`${input} min-h-56 font-mono text-[13px] leading-6`} value={t.body} onChange={(e) => change(t.id, { body: e.target.value })} />
                  </label>
                  {templates.length > 1 && (
                    <button type="button" onClick={() => persist(templates.filter((x) => x.id !== t.id))} className="inline-flex items-center gap-1.5 text-sm text-[#c5221f] hover:underline">
                      <Trash className="h-4 w-4" />Delete template
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => persist(templates.map((t) => ({ ...t, name: t.name.trim() || "Untitled" })))} disabled={!dirty} className="rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-50">
          Save templates
        </button>
        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-full border border-[#747775] px-4 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] dark:border-zinc-600 dark:text-blue-300">
          <Plus className="h-4 w-4" />Add template
        </button>
        <button type="button" onClick={() => persist(DEFAULT_TEMPLATES)} className="inline-flex items-center gap-1.5 px-2 py-2 text-sm text-[#5f6368] hover:text-[#1f1f1f] dark:text-zinc-400">
          <RotateCcw className="h-4 w-4" />Reset to built-in
        </button>
        {savedFlash && <span className="inline-flex items-center gap-1 text-sm text-[#188038]"><Check className="h-4 w-4" />Saved</span>}
        {dirty && !savedFlash && <span className="text-sm text-[#5f6368]">Unsaved changes</span>}
      </div>
    </div>
  );
}
