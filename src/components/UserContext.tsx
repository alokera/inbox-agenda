"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";

export const UserContext = createContext<SessionUser | null>(null);

export function useUser(): SessionUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside the signed-in app shell");
  return user;
}
