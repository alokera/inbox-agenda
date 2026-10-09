import { avatarColor, initials } from "@/lib/ui-format";

export function Avatar({ name, email, size = "md" }: { name: string; email: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-9 w-9 text-sm", lg: "h-11 w-11 text-base" };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${avatarColor(email || name)}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
