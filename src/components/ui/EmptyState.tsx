import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        {description && <p className="max-w-sm text-sm text-zinc-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}
