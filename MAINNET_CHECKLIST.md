# Nimbus — mainnet verification checklist

What Cowork changed (code + diagnostics only — **no real funds were spent**), and
exactly what you must confirm by hand with your own funded wallet. Work top to
bottom; Block 1 and 2 are the must-pass items for the demo.

> Two known cleanup items in the repo root, both harmless:
> - `build-check.log` — a leftover build log (now gitignored). Delete it: `rm build-check.log`.
> - `.git/index.lock` — a stale git lock from an interrupted status. If a commit
>   complains, delete it: `rm .git/index.lock`.

---

## Quick pre-flight (no spend)

```bash
npm run typecheck          # must print nothing (passes clean today)
node --env-file=.env.local scripts/check-account.mjs 0xYOUR_OWNER_EOA
node --env-file=.env.local scripts/fees.mjs 0xYOUR_OWNER_EOA 0.5   # fee for one charge
```

`check-account` shows funding, 7702 delegation, and the unified balance.
`fees.mjs` prints the real cross-chain fee for a charge — **this is your true
burn per cross-chain cycle** (payments themselves go to your own merchant
address and are recoverable).

---

## Block 1 — reliability on stage (must pass)

### 1.1 Partial failure (Convert settled, transfer failed)

Changed: `hooks/useSubscription.ts` now tracks `convertSettledRef`. If the
transfer after a Convert fails, the UI shows an amber **"Funds moved, payment
not finished"** banner with a **Finish payment** button. Retrying resumes at the
transfer — it does **not** Convert again.

Verify on mainnet:
- [ ] Force a cross-chain charge (funds only on a non-Arbitrum chain). Confirm
      the charge runs Convert → transfer and settles normally.
- [ ] To exercise the partial path, interrupt after Convert settles (e.g. kill
      the tab / network during "Paying merchant"), reload, and confirm the amber
      banner appears and **Finish payment** completes **without a second
      Convert** (watch `scripts/tx-list.mjs` — you should see one convert, then
      one transfer, not two converts).

### 1.2 Maintenance / error states

Changed: `lib/utils.ts` `classifyError()` maps `-32801`, `-32653`, `-32602`,
and settlement/refund failures to calm copy; transient ones auto-retry once in
the background auto-charge loop.

Verify:
- [ ] If you hit a real maintenance window, confirm the UI shows the friendly
      message (not a raw code) and doesn't crash.
- [ ] `-32602` / route-too-small shows the "amount too small to route" copy.

### 1.3 Burn-rate guard

Changed: auto-billing pauses when unified balance < `price + LOW_BALANCE_STOP_USD`
(default $0.5). SubscriptionCard shows cycles-left + live balance; a low-balance
notice appears when paused.

Verify:
- [ ] Run a full demo session; confirm the balance readout ticks down and the
      "auto-billing paused" notice appears before the wallet is drained.
- [ ] Record the real cost of one full run: `price × maxCycles` +
      (fee-per-cross-chain-cycle × cross-chain cycles). Use `fees.mjs`.

### 1.4 Convert buffer

Changed: before Converting, `estimateConvert()` quotes what would actually
arrive; if short of price + gas floor, the Convert amount is topped up. Fixed
buffer is now only a floor and is env-configurable
(`NEXT_PUBLIC_CONVERT_BUFFER_*`, `_GAS_FLOOR_USD`).

Verify:
- [ ] `node --env-file=.env.local scripts/fees.mjs 0xYOUR_EOA 0.5` and compare
      the reported fee to the default buffers (0.0002 ETH / $0.4). If live fees
      exceed the buffer, the quote-topup covers it — confirm a real cross-chain
      charge still lands the full price to the merchant.

---

## Block 2 — Universal Accounts visibility

### 2.1 Cross-chain moment

Changed: `components/ChargeProgress.tsx` now shows a **source-chain → Arbitrum**
journey banner with a moving dot while charging, and "Merchant receiving USDC on
Arbitrum" on landing. Source chain is derived from your real balance.

Verify:
- [ ] With funds on Base, start a charge and confirm the banner reads
      **Base → Arbitrum** and the dot animates during convert/bridge, then lights
      the destination on pay/confirm. **Coordinate this framing with your video
      editor — this is the shot.**

### 2.2 Balance as proof

Changed: `UniversalBalanceCard` shows an **"Aggregated from N chains — spendable
as one"** chip and a "Where it actually lives" per-chain breakdown.

Verify:
- [ ] With funds on 2+ chains, confirm the chip shows the right count and the
      breakdown lists each chain.

---

## Block 3 — documentation

Changed: `README.md` gained **"Why this is technically hard"**, **"What the hook
adds on top of the SDK"** (naïve vs. ours), **"Is headless signing safe?"**, and
a **"What's next"** (session keys) section. `.env.example` documents the new
knobs. Nothing to verify on-chain — read it and confirm the pitch answers match
how you'll present.

---

## Block 4 — Pro-status criterion

Changed: `hooks/useSubscription.ts` derives Pro from settled merchant transfers
that **match the price (±5%)** and fall **within an active window** (one period +
grace; whole session in demo mode). Falls back to the looser match if amount
units surprise us, so it can't regress.

Verify:
- [ ] After a real charge, confirm "Pro active" shows and survives reload.
- [ ] `node --env-file=.env.local scripts/tx-list.mjs 0xYOUR_EOA` — confirm the
      merchant transfer `change.amount` really is `~0.5` (human units). If it's
      raw units, tell Cowork and the amount match will be adjusted (the fallback
      keeps Pro working meanwhile).

---

## Files changed

- `lib/utils.ts` — `classifyError()` + error-code table (1.2)
- `lib/config.ts` — `CROSS_CHAIN`, `SUBSCRIPTION_MATCH` knobs (1.3/1.4/4)
- `lib/chains.ts` — **new**; shared chain names + `dominantSourceChain` (2.1/2.2)
- `hooks/useUniversalUpgrade.ts` — `estimateConvert()` (1.4)
- `hooks/useSubscription.ts` — partial-failure resume, quote-driven Convert,
  burn guard, tightened Pro criterion (1.1/1.3/1.4/4)
- `components/ChargeProgress.tsx` — cross-chain journey banner (2.1)
- `components/UniversalBalanceCard.tsx` — aggregation proof (2.2)
- `components/SubscriptionCard.tsx` — partial/low-balance/cycles UI (1.1/1.3)
- `components/ProDashboard.tsx` — wires source chain + new state
- `components/BillingHistory.tsx` — dedupe onto `lib/chains`
- `app/globals.css` — `slide` keyframe for the journey dot
- `README.md`, `.env.example`, `.gitignore` — docs + new knobs

**Not done (out of scope, per brief):** Openfort, ZeroDev, session keys,
pay-with selector, new chains, core refactor. No payments executed.
