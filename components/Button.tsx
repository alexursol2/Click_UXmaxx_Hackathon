import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "subtle";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa00ff]/70";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-[#aa00ff] to-[#6600cc] text-white shadow-lg shadow-[#aa00ff]/25 hover:from-[#b833ff] hover:to-[#7a14e6] active:scale-[0.99]",
  ghost:
    "border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10",
  subtle: "text-neutral-400 hover:text-neutral-200",
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
