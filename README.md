# Nimbus — chain-abstracted subscriptions

Email login → a Particle **Universal Account** (via EIP-7702) → a recurring subscription paid from **one unified balance**, sourced from the user's assets on _any_ chain. No seed phrase, no network switching, no signing popups.

**Proven on mainnet:** ETH held on Base paid a merchant in USDC on Arbitrum — converted, bridged, and settled automatically, with every signature headless.

This repo is two things at once:

1. A **demo storefront** (a fake SaaS, "Nimbus Pro") you can run in two minutes.
2. A **starter template** — the interesting part is one clean, reusable hook.

---

## The 3-line integration

```tsx
import { useUniversalUpgrade } from "@/hooks/useUniversalUpgrade";

const { upgrade, isUniversal, universalBalance } = useUniversalUpgrade();
// universalBalance.totalUsd → one spendable number across every chain
// upgrade()                 → turn the email EOA into a Universal Account
```

That's the whole product surface for chain abstraction. Everything else is UI.

---

## Quickstart

```bash
git clone <this-repo> nimbus && cd nimbus
npm install
cp .env.example .env.local     # then paste your keys (below)
npm run dev                     # → http://localhost:3000
```

### The keys you need

All keys are **publishable, client-side** keys (safe in the browser bundle) — hence the `NEXT_PUBLIC_` prefix.

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_MAGIC_KEY` | [Magic dashboard](https://dashboard.magic.link) (`pk_live_…`) |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` / `_CLIENT_KEY` / `_APP_ID` | [Particle dashboard](https://dashboard.particle.network) |
| `NEXT_PUBLIC_MERCHANT_ADDRESS` | where payments land — use an address you control |

Optional knobs: price (`…_PRICE_USD`, default $5), settlement token (`…_SUBSCRIPTION_TOKEN=eth` for native ETH + `…_PRICE_ETH`), settlement chain (`…_SUBSCRIPTION_CHAIN_ID`), and **demo billing** (`…_BILLING_INTERVAL_SECONDS=10`, `…_BILLING_MAX_CYCLES=3` → after the first charge, the app auto-charges every 10 s, three total — recurring you can watch live).

---

## How it works

```
 ┌──────────────┐   email OTP    ┌──────────────────┐    EIP-7702    ┌────────────────────┐
 │ Magic wallet  │ ─────────────▶ │ useUniversal-     │ ─────────────▶ │ Particle Universal │
 │ (EOA, no seed │  headless sign │ Upgrade()         │   type-4 tx    │ Account: unified   │
 │ phrase)       │                │ = the product     │                │ cross-chain balance │
 └──────────────┘                └──────────────────┘                └────────────────────┘
```

- **Magic** turns an email into an embedded wallet. Signing is headless — no
  confirmation popups — which is what makes recurring charges feel like a
  normal SaaS, and its `sign7702Authorization()` signs the EIP-7702 tuple.
- **Particle Universal Accounts (SDK v2)** abstracts balances across chains
  into one number and one place to spend from.
- **EIP-7702** upgrades the plain email EOA into that Universal Account. The
  authorization rides along with the first transaction — no separate setup tx.

### The charge flow (v2 backend)

On Particle's v2 backend, a transfer spends tokens already on the settlement
chain; cross-chain sourcing is a **Convert** (`createConvertTransaction`) that
rebalances your assets first. `chargeSubscription()` handles it end to end:

```
transfer ── funds already on settlement chain? ──▶ settle ✓
   │ no
   ▼
convert (any chain → settlement chain) ──▶ wait for on-chain settlement
   ▼
transfer ──▶ wait for on-chain settlement ──▶ "Pro active"
```

Two hard-won lessons are baked in:

1. **`sendTransaction` resolving ≠ money moved.** Cross-chain operations
   settle asynchronously; `waitForSettlement()` polls until terminal status
   (7 = FINISHED) and the UI never claims success before the chain does.
2. **Subscription state lives on-chain.** On load, the app counts settled
   transfers to the merchant in the account's history — "Pro" survives
   reloads with no backend, because the chain is the database.

Target chain: **Arbitrum One** (settlement); user funds can sit anywhere the
Universal Account supports (Ethereum, Base, BNB, Arbitrum, XLayer, Solana).

---

## Project structure

```
app/
  layout.tsx · page.tsx        # auth gate: login ⇄ dashboard
hooks/
  useUniversalUpgrade.ts       # ★ the reusable product: upgrade, unified
                               #   balance, transfer/convert, settlement
  useSubscription.ts           # charge flow, on-chain Pro state, demo billing
lib/
  magic.ts                     # email login, ethers signer, 7702 adapter
  config.ts                    # chain, price, tokens, env validation
  utils.ts                     # formatting + friendly error mapping
components/
  LoginCard · ProDashboard · UniversalBalanceCard · SubscriptionCard
  ChargeProgress · BillingHistory · Button
scripts/
  check-account.mjs            # balances + delegation + unified balance
  tx-list.mjs                  # Particle history with statuses
  probe-*.mjs · fees.mjs       # read-only route/fee quoting (no keys, no spend)
```

The hook has **no dependency on the UI or the subscription** — lift
`hooks/useUniversalUpgrade.ts` + `lib/magic.ts` into any Next app and you have
chain abstraction.

The `scripts/` diagnostics deserve a mention: quotes are free (nothing is
signed), so you can probe routing, fees, and settlement **with only a public
address** — `node --env-file=.env.local scripts/check-account.mjs 0xYourAddress`.

---

## Deploy to Vercel

Stock Next.js App Router app — Vercel auto-detects it.

1. Push to GitHub and import the repo in Vercel.
2. Add your `NEXT_PUBLIC_*` variables in **Project → Settings → Environment Variables**.
3. Deploy. No build config required.

---

## Notes

- Mainnet flows are meant to be tested with your own keys and a funded wallet;
  the code never executes transactions on its own.
- Requires `@particle-network/universal-account-sdk` **v2+** — v1 was
  deprecated and its backend sunset in June 2026.
- The hook is intentionally **not** published to npm — it's a copy-in starter.
