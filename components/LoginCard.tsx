"use client";

import { useState } from "react";
import { loginWithEmail } from "@/lib/magic";
import { friendlyError } from "@/lib/utils";
import { Button } from "./Button";

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
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur">
      <div className="mb-6 text-center">
        <video
          src="/logo.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Nimbus Pro
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Sign in with your email. No wallet, no seed phrase — we handle the
          rest.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-[#aa00ff]/60 focus:outline-none"
        />
        <Button type="submit" busy={busy} className="w-full">
          {busy ? "Check your inbox…" : "Continue with email"}
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-xs text-neutral-500">
        Powered by a Magic embedded wallet · secured on-chain
      </p>
    </div>
  );
}
