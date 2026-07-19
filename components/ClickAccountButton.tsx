"use client";

/**
 * ClickAccountButton — a drop-in "Account" button.
 *
 *   <ClickAccountButton />
 *
 * Opens the Account panel: email login when signed out, and the unified
 * balance + add-funds + pay-with picker when signed in. A green dot shows when
 * the visitor is signed in. Style via `className`/`children` or use the default.
 */

import { useClickAccount } from "./ClickProvider";

export function ClickAccountButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { openAccount, auth } = useClickAccount();

  return (
    <button
      type="button"
      onClick={openAccount}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-xl border-2 border-[color:var(--purple)] bg-white px-4 py-2 text-sm font-bold text-[color:var(--purple)] transition-colors hover:bg-[color:var(--purple)] hover:text-white"
      }
    >
      {auth === "in" && (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
      )}
      {children ?? "Account"}
    </button>
  );
}
