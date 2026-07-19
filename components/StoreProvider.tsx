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
  /** "pay" = to the merchant; "withdraw" = to the user's external address. */
  mode: "pay" | "withdraw";
  label: string;
  amountUsd: number;
  message?: string;
  /** Re-runs the same action (used by the status card's "Try again"). */
  retry?: () => void;
}

// `withdraw` is re-declared at the store level as a fire-and-forget action (it
// drives the status card), so omit the raw Promise version from UseCheckout.
export interface StoreContextValue extends Omit<UseCheckout, "withdraw"> {
  auth: AuthState;
  /** Called by the login form once Magic OTP succeeds. */
  onLoggedIn: () => void;
  logout: () => Promise<void>;

  accountOpen: boolean;
  openAccount: () => void;
  closeAccount: () => void;

  /** Entry point for every buy button. Handles the login gate + status. */
  pay: (amountUsd: number, label: string) => void;
  /** Withdraw to an external address. Shows progress in the status card. */
  withdraw: (amountUsd: number, toAddress: string) => void;
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

/** localStorage flag: were we signed in? Lets refresh restore the UI instantly. */
const AUTH_FLAG = "click:auth";

/** Shorten an address for labels: 0x1234…abcd. */
function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
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

  // Resolve the session on mount, persisting login across refreshes. The Magic
  // session itself survives a reload; we also cache a lightweight flag so the
  // signed-in UI comes back INSTANTLY (no "checking" flash), then reconcile with
  // the real session in the background. A transient error keeps the optimistic
  // state rather than kicking the user out.
  useEffect(() => {
    const optimistic =
      typeof window !== "undefined" &&
      window.localStorage.getItem(AUTH_FLAG) === "1";
    if (optimistic) setAuth("in");
    isLoggedIn()
      .then((yes) => {
        setAuth(yes ? "in" : "out");
        if (typeof window !== "undefined") {
          if (yes) window.localStorage.setItem(AUTH_FLAG, "1");
          else window.localStorage.removeItem(AUTH_FLAG);
        }
      })
      .catch(() => {
        if (!optimistic) setAuth("out");
      });
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
      const retry = () => void runPay(amountUsd, label);
      setStatus({ kind: "charging", mode: "pay", label, amountUsd, retry });
      try {
        await checkout.checkout(amountUsd);
        setChargeCount((n) => n + 1);
        setStatus({ kind: "success", mode: "pay", label, amountUsd });
      } catch (e) {
        setStatus({
          kind: "error",
          mode: "pay",
          label,
          amountUsd,
          retry,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [checkout]
  );

  const runWithdraw = useCallback(
    async (amountUsd: number, toAddress: string) => {
      const label = shortAddr(toAddress);
      const retry = () => void runWithdraw(amountUsd, toAddress);
      setStatus({ kind: "charging", mode: "withdraw", label, amountUsd, retry });
      try {
        await checkout.withdraw(amountUsd, toAddress);
        setStatus({ kind: "success", mode: "withdraw", label, amountUsd });
      } catch (e) {
        setStatus({
          kind: "error",
          mode: "withdraw",
          label,
          amountUsd,
          retry,
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

  const withdraw = useCallback(
    (amountUsd: number, toAddress: string) => {
      if (amountUsd <= 0 || !toAddress) return;
      // Close the Account panel so the status card (bottom-right) is visible.
      setAccountOpen(false);
      void runWithdraw(amountUsd, toAddress);
    },
    [runWithdraw]
  );

  const onLoggedIn = useCallback(() => {
    setAuth("in");
    if (typeof window !== "undefined")
      window.localStorage.setItem(AUTH_FLAG, "1");
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
    // Always tear down the LOCAL session, even if Magic's logout rejects or
    // hangs (which on mainnet would otherwise leave the button doing nothing).
    try {
      await magicLogout();
    } catch (e) {
      console.warn("Magic logout failed; clearing local session anyway.", e);
    } finally {
      pendingRef.current = null;
      if (typeof window !== "undefined") window.localStorage.removeItem(AUTH_FLAG);
      setAuth("out");
      setAccountOpen(false);
      setStatus(null);
    }
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
    withdraw, // store-level (void) — overrides the raw Promise from ...checkout
    status,
    dismissStatus: () => setStatus(null),
    chargeCount,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
