"use client";

import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/lib/session";
import { Avatar } from "../ui/Avatar";

export function AccountMenu({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const picture = (large: boolean) =>
    user.picture ? (
      // eslint-disable-next-line @next/next/no-img-element -- small external Google avatar
      <img src={user.picture} alt="" className={`${large ? "h-20 w-20" : "h-8 w-8"} rounded-full`} referrerPolicy="no-referrer" />
    ) : (
      <Avatar name={user.name ?? user.email} email={user.email} size={large ? "lg" : "sm"} />
    );

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/10" aria-label="Google account" aria-expanded={open}>
        {picture(false)}
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-50 w-80 rounded-[28px] bg-[#e9eef6] p-2 shadow-[0_4px_8px_3px_rgba(60,64,67,0.15),0_1px_3px_rgba(60,64,67,0.3)] dark:bg-zinc-800">
          <p className="truncate px-4 pb-3 pt-2 text-center text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">{user.email}</p>
          <div className="flex flex-col items-center gap-2 pb-4">
            {picture(true)}
            <p className="text-[22px] text-[#1f1f1f] dark:text-zinc-100">Hi, {user.name?.split(" ")[0] ?? "there"}!</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[#1f1f1f] hover:bg-[#f8fafd] dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-950"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <p className="px-4 pb-1 pt-3 text-center text-[11px] text-[#444746] dark:text-zinc-400">Signing out also revokes InboxAgenda&apos;s access to your Google account.</p>
        </div>
      )}
    </div>
  );
}
