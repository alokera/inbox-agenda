"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";
import type { LabelCounts } from "@/lib/types";

export const UserContext = createContext<SessionUser | null>(null);

export function useUser(): SessionUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside the signed-in app shell");
  return user;
}

interface Mailbox {
  counts: LabelCounts | null;
  refreshCounts: () => void;
}

export const MailboxContext = createContext<Mailbox>({ counts: null, refreshCounts: () => {} });

export function useMailbox(): Mailbox {
  return useContext(MailboxContext);
}
