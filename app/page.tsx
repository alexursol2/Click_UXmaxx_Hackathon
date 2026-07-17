"use client";

import { useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/magic";
import { LoginCard } from "@/components/LoginCard";
import { ProDashboard } from "@/components/ProDashboard";

type AuthState = "checking" | "out" | "in";

export default function Home() {
  const [auth, setAuth] = useState<AuthState>("checking");

  useEffect(() => {
    isLoggedIn()
      .then((yes) => setAuth(yes ? "in" : "out"))
      .catch(() => setAuth("out"));
  }, []);

  return (
    <main className="relative min-h-screen">
      {/* backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(170,0,255,0.16),transparent)]"
      />
      <div className="relative">
        {auth === "checking" && (
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          </div>
        )}

        {auth === "out" && (
          <div className="flex min-h-screen items-center justify-center p-6">
            <LoginCard onLoggedIn={() => setAuth("in")} />
          </div>
        )}

        {auth === "in" && <ProDashboard onLoggedOut={() => setAuth("out")} />}
      </div>
    </main>
  );
}
