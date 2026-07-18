"use client";

import { useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/magic";
import { UniversalSubscriptionProvider } from "@/components/UniversalSubscriptionProvider";
import { LoginCard } from "@/components/LoginCard";
import { ProDashboard } from "@/components/ProDashboard";

type AuthState = "checking" | "out" | "in";

function AuthGate() {
  const [auth, setAuth] = useState<AuthState>("checking");

  useEffect(() => {
    isLoggedIn()
      .then((yes) => setAuth(yes ? "in" : "out"))
      .catch(() => setAuth("out"));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Drifting background "clouds" — soft pink/lavender between white & purple */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -left-24 -top-24 h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(239,111,253,0.22), transparent 70%)",
            animation: "drift-a 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute right-[-8rem] top-1/3 h-[34rem] w-[34rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(180,120,255,0.16), transparent 70%)",
            animation: "drift-b 26s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-10rem] left-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(245,205,255,0.28), transparent 70%)",
            animation: "drift-c 23s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative z-10">
        {auth === "checking" && (
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#9b03f2]/20 border-t-[#9b03f2]" />
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

export default function Home() {
  // One wrap configures the whole library (env defaults here; a host app would
  // pass config={{ merchant, price, chain, ... }}).
  return (
    <UniversalSubscriptionProvider>
      <AuthGate />
    </UniversalSubscriptionProvider>
  );
}
