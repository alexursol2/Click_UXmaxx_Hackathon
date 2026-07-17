/** Tiny className joiner (no dependency needed). */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/** Shorten an address for display, e.g. "0x1234…cdef". */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Format a USD number for prominent display, e.g. 1234.5 → "$1,234.50". */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Map any thrown error to a calm, human message (no crypto jargon, no hashes). */
export function friendlyError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  // Particle rejects at quote time when a route can't actually land the amount
  // on the destination chain — usually because the payment is too small to
  // survive swap + bridge + gas, or the balance can't cover those costs.
  if (
    msg.includes("would fail on the target chain") ||
    msg.includes("check the transaction parameters") ||
    msg.includes("no route") ||
    msg.includes("cannot find route")
  ) {
    return "We couldn't route this payment to the merchant. The amount may be too small to cover cross-chain fees, or your balance is too low. Try adding funds.";
  }
  if (
    msg.includes("insufficient") ||
    msg.includes("not enough") ||
    msg.includes("exceeds balance")
  ) {
    return "Not enough balance to cover the charge and network fees. Add funds on any chain and try again.";
  }
  if (
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("cancel")
  ) {
    return "That was cancelled. No charge was made.";
  }
  if (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch") ||
    msg.includes("connection")
  ) {
    return "Network hiccup reaching the chain. Please try again in a moment.";
  }
  if (msg.includes("sign in") || msg.includes("log in")) {
    return "Please sign in with your email first.";
  }
  return "Something went wrong. Please try again.";
}
