"use client";

import { useState } from "react";
import { loginWithEmail } from "@/lib/magic";
import { friendlyError } from "@/lib/utils";

export function LoginCard({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithEmail(email.trim());
      onLoggedIn();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-[color:var(--border)] bg-white shadow-2xl">
      {/* Purple header band */}
      <div className="bg-[color:var(--purple)] px-8 pb-7 pt-8 text-center">
        {/* White badge so the purple logo doesn't vanish on the purple band */}
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Click" className="h-11 w-11 object-contain" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Pay in one Click
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-white/85">
          Sign in with your email — no wallet, no seed phrase.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="space-y-3 px-8 pb-6 pt-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Email
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-[color:var(--text)] placeholder:text-gray-400 transition-colors focus:border-[color:var(--purple)] focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--purple)] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[color:var(--purple-deep)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {busy ? "Check your inbox…" : "Continue with email"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      <p className="border-t border-gray-100 px-8 py-4 text-center text-xs text-[color:var(--muted)]">
        Powered by a Magic embedded wallet · secured on-chain
      </p>
    </div>
  );
}
