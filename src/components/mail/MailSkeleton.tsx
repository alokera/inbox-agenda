import { Skeleton } from "../ui/Skeleton";

export function MailSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <ul>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex h-10 items-center gap-3 border-b border-[#f1f3f4] px-4 dark:border-zinc-800">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3 w-12" />
        </li>
      ))}
    </ul>
  );
}
