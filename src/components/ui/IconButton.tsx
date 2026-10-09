export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}
