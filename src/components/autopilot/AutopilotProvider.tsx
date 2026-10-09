"use client";

import { Bot, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { runAutopilot } from "@/lib/autopilot-runner";
import { loadLastRun, loadSettings, type AutopilotRun } from "@/lib/autopilot-store";
import { useMailbox } from "../UserContext";

const RUN_EVERY_MS = 60 * 60 * 1000; // hourly while the app is open
const CHECK_EVERY_MS = 5 * 60 * 1000;

interface AutopilotState {
  running: boolean;
  status: string | null;
  error: string | null;
  lastRun: AutopilotRun | null;
  /** Bumped after every run so pages can reload the queue and log. */
  version: number;
  runNow: () => Promise<void>;
}

const AutopilotContext = createContext<AutopilotState | null>(null);

export function useAutopilot(): AutopilotState {
  const value = useContext(AutopilotContext);
  if (!value) throw new Error("useAutopilot must be used inside AutopilotProvider");
  return value;
}

/** Runs Autopilot on a schedule while any page of the app is open, and shares its status. */
export function AutopilotProvider({ children }: { children: React.ReactNode }) {
  const { canDraft } = useMailbox();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<AutopilotRun | null>(null);
  const [version, setVersion] = useState(0);
  const busy = useRef(false);

  const runNow = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setError(null);
    try {
      const result = await runAutopilot({ canSend: canDraft, onStatus: setStatus });
      if (result) setLastRun(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autopilot failed");
    } finally {
      busy.current = false;
      setRunning(false);
      setStatus(null);
      setVersion((v) => v + 1);
    }
  }, [canDraft]);

  useEffect(() => {
    loadLastRun().then(setLastRun);
  }, []);

  // Check every few minutes whether a scheduled run is due.
  useEffect(() => {
    const tick = async () => {
      const [settings, last] = await Promise.all([loadSettings(), loadLastRun()]);
      if (settings.mode !== "off" && (!last || Date.now() - last.at >= RUN_EVERY_MS)) void runNow();
    };
    const first = setTimeout(tick, 15_000); // let the app settle after load
    const interval = setInterval(tick, CHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [runNow]);

  return <AutopilotContext.Provider value={{ running, status, error, lastRun, version, runNow }}>{children}</AutopilotContext.Provider>;
}

/** Small top-bar chip shown while Autopilot is working. */
export function AutopilotIndicator() {
  const { running, status } = useAutopilot();
  if (!running) return null;
  return (
    <Link href="/autopilot" title={status ?? "Autopilot is running"} className="hidden items-center gap-1.5 rounded-full bg-[#d3e3fd] px-3 py-1.5 text-xs font-medium text-[#001d35] sm:inline-flex dark:bg-blue-900/60 dark:text-blue-50">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      <Bot className="h-3.5 w-3.5" />
      Autopilot
    </Link>
  );
}
