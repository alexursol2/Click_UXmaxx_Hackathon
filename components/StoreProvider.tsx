"use client";

/**
 * StoreProvider — the glue between the OnlyCrabs storefront and the Click hooks.
 *
 * One useCheckout() instance is created here and shared (via context) by both
 * the storefront buy buttons and the Account modal, so the pay-with choice and
 * the unified balance stay in sync across the whole app.
 *
 * Buy flow (store.pay):
 *   - not logged in  → remember the pending purchase, open the Account modal so
 *     the user logs in; on success the purchase resumes automatically.
 *   - logged in      → charge immediately, no popup — only a live status card.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isLoggedIn, logout as magicLogout } from "@/lib/magic";
import { useCheckout, type UseCheckout } from "@/hooks/useCheckout";

export type AuthState = "checking" | "out" | "in";

export interface PayStatus {
  kind: "charging" | "success" | "error";
  label: string;
  amountUsd: number;
  message?: string;
}

interface StoreContextValue extends UseCheckout {
  auth: AuthState;
  /** Called by the login form once Magic OTP succeeds. */
  onLoggedIn: () => void;
  logout: () => Promise<void>;

  accountOpen: boolean;
  openAccount: () => void;
  closeAccount: () => void;

  /** Entry point for every buy button. Handles the login gate + status. */
  pay: (amountUsd: number, label: string) => void;
  status: PayStatus | null;
  dismissStatus: () => void;

  /** Bumps on each settled charge — drives BillingHistory refresh. */
  chargeCount: number;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const checkout = useCheckout();

  const [auth, setAuth] = useState<AuthState>("checking");
  const [accountOpen, setAccountOpen] = useState(false);
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [chargeCount, setChargeCount] = useState(0);

  // A purchase clicked while logged-out, resumed after login.
  const pendingRef = useRef<{ amountUsd: number; label: string } | null>(null);

  const { refreshBalance } = checkout;

  // Resolve the session on mount.
  useEffect(() => {
    isLoggedIn()
      .then((yes) => setAuth(yes ? "in" : "out"))
      .catch(() => setAuth("out"));
  }, []);

  // While signed in, keep the unified balance fresh (mirrors the dashboard).
  useEffect(() => {
    if (auth !== "in") return;
    let alive = true;
    const tick = () => {
      if (alive) refreshBalance().catch(() => {});
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [auth, refreshBalance]);

  const runPay = useCallback(
    async (amountUsd: number, label: string) => {
      setStatus({ kind: "charging", label, amountUsd });
      try {
        await checkout.checkout(amountUsd);
        setChargeCount((n) => n + 1);
        setStatus({ kind: "success", label, amountUsd });
      } catch (e) {
        setStatus({
          kind: "error",
          label,
          amountUsd,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [checkout]
  );

  const pay = useCallback(
    (amountUsd: number, label: string) => {
      if (amountUsd <= 0) return;
      if (auth !== "in") {
        // Login gate: stash the purchase, open the modal for OTP login.
        pendingRef.current = { amountUsd, label };
        setAccountOpen(true);
        return;
      }
      void runPay(amountUsd, label);
    },
    [auth, runPay]
  );

  const onLoggedIn = useCallback(() => {
    setAuth("in");
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      setAccountOpen(false);
      void runPay(pending.amountUsd, pending.label);
    }
    // No pending purchase → they opened Account to sign in; leave it open so
    // they land on the dashboard.
  }, [runPay]);

  const logout = useCallback(async () => {
    await magicLogout();
    pendingRef.current = null;
    setAuth("out");
    setAccountOpen(false);
  }, []);

  const value: StoreContextValue = {
    ...checkout,
    auth,
    onLoggedIn,
    logout,
    accountOpen,
    openAccount: () => setAccountOpen(true),
    closeAccount: () => setAccountOpen(false),
    pay,
    status,
    dismissStatus: () => setStatus(null),
    chargeCount,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
