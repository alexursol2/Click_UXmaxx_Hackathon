import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "subtle";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b03f2]/70";

const variants: Record<Variant, string> = {
  primary: "bg-[#9b03f2] text-white hover:bg-[#7209a5] active:scale-[0.99]",
  ghost:
    "border border-[color:var(--border)] bg-[#9b03f2]/[0.05] text-[color:var(--text)] hover:bg-[#9b03f2]/[0.1]",
  subtle: "text-[color:var(--muted)] hover:text-[color:var(--text)]",
};

export function Button({
  variant = "primary",
  busy = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], "px-5 py-3 text-sm", className)}
      disabled={disabled || busy}
      {...props}
    >
      {busy && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
        />
      )}
      {children}
    </button>
  );
}
