"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** Gmail-style pill search. Searches all mail with Gmail syntax (from:, has:attachment, newer_than:…). */
export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);
  const [lastSeen, setLastSeen] = useState(current);

  // Keep the box in sync when the URL changes (back/forward, clearing a search).
  if (current !== lastSeen) {
    setLastSeen(current);
    setValue(current);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/all?q=${encodeURIComponent(q)}` : "/inbox");
  }

  function clear() {
    setValue("");
    if (current) router.push("/inbox");
  }

  return <SearchForm value={value} onChange={setValue} onSubmit={submit} onClear={clear} />;
}

/** Static version shown while the URL is being read. */
export function SearchBarFallback() {
  return <SearchForm value="" onChange={() => {}} onSubmit={(e) => e.preventDefault()} onClear={() => {}} />;
}

interface FormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}

function SearchForm({ value, onChange, onSubmit, onClear }: FormProps) {
  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="flex h-12 w-full max-w-[720px] items-center rounded-full bg-[#e9eef6] pl-1 pr-2 transition focus-within:bg-white focus-within:shadow-[0_1px_1px_0_rgba(65,69,73,0.3),0_1px_3px_1px_rgba(65,69,73,0.15)] dark:bg-zinc-800"
    >
      <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-zinc-300 dark:hover:bg-white/10" aria-label="Search">
        <Search className="h-5 w-5" />
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search mail"
        aria-label="Search mail"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-[#1f1f1f] outline-none placeholder:text-[#444746] dark:text-zinc-100 dark:placeholder:text-zinc-400"
      />
      {value && (
        <button type="button" onClick={onClear} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-zinc-300 dark:hover:bg-white/10" aria-label="Clear search">
          <X className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}
