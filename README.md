# Click — chain-abstracted payments

**Log in with an email. Pay from one balance — even if your money is on Solana
and the merchant is on Arbitrum.** No seed phrase, no network switching, no
bridging, no signing popups. Buy in one click, or subscribe.

Built for the **UXmaxx hackathon — Universal Accounts track** on
**Magic** (embedded email wallet) + **Particle Network Universal Accounts**
(EIP-7702) + **Arbitrum / Solana**.

> **Proven on mainnet — not a mock.**
> - EVM: ETH held on **Base** paid a merchant in **USDC on Arbitrum** (converted, bridged, settled).
> - Solana: **SOL on Solana** paid a merchant in **USDC on Arbitrum** — one click, signed with a single EVM signature, no Solana signer. _(convert `101→Arbitrum` + transfer, both status 7, on 2026-07-18.)_

This repo is two things at once:

1. A **demo storefront** — **OnlyCrabs**, where every "Pay with crypto in one
   Click" button charges from your unified balance. Click **Account** to sign in
   (email OTP) and see your balance, add funds, and pick which coin pays. Once
   signed in, a buy charges silently — the only thing you see is a live status
   card. Run it in two minutes.
2. A **reusable library** — wrap a provider, call a hook. Two charge shapes:
   `useCheckout` (one-time, any amount) and `useSubscription` (recurring).

---

## Table of contents

- [Add Click to any site](#add-click-to-any-site-drop-in)
- [The library in 2 steps](#the-library-in-2-steps)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [The charge flow](#the-charge-flow)
- [Solana → Arbitrum](#solana--arbitrum)
- [Why this is technically hard](#why-this-is-technically-hard)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Public API](#public-api)
- [Deploy](#deploy)
- [Roadmap](#roadmap)

---

## Add Click to any site (drop-in)

The whole account — email login, unified cross-chain balance, add-funds, pick
which coin pays, and one-click checkout — is **three imports**. No wallet UI to
build:

```bash
npm install clickpay
```

```tsx
import { ClickProvider, ClickAccountButton, ClickPayButton } from "clickpay";
import "clickpay/styles.css"; // ships the widget styles + design tokens

export default function App() {
  return (
    <ClickProvider config={{ merchant: "0xYourReceivingAddress" }}>
      <header>
        <ClickAccountButton />           {/* login · balance · add funds · pay-with */}
      </header>

      <ClickPayButton amount={9.99} label="Pro plan" />
    </ClickProvider>
  );
}
```

`<ClickProvider>` mounts the login popup and the payment status card for you, so
a button anywhere just works:

- **Signed out** → clicking pay opens the email login; after the code, the
  purchase resumes automatically.
- **Signed in** → the charge runs silently; progress shows in the status card
  (Preparing → Paying → Confirming → Paid ✓), cross-chain if the funds are
  elsewhere.

Prefer your own UI? Read the hook — it's the account, in one object:

```tsx
import { useClickAccount } from "clickpay";

const {
  auth,                 // "checking" | "out" | "in"
  openAccount, logout,  // open the built-in login/account panel; sign out
  universalBalance,     // unified cross-chain balance
  payWith, setPayWith, availableTokens,   // which coin funds the charge
  pay,                  // pay(amount, label): login-gates + shows status for you
  withdraw,             // withdraw(amount, toAddress): send funds to an external wallet
  checkout,             // checkout(amount): charge directly (throws on failure)
  charging, stage,      // live progress
} = useClickAccount();

<button onClick={() => pay(9.99, "Pro plan")}>Buy</button>
```

(For a fully custom login form instead of `openAccount()`, import
`loginWithEmail` from `lib/magic`.)

---

## The library in 2 steps

Everything a host app configures lives in one object, injected via a provider.
The demo works with zero props (env defaults); any other business drops the
provider in and it's their storefront — no code edits.

```tsx
// 1. Wrap once
import { UniversalSubscriptionProvider } from "@/components/UniversalSubscriptionProvider";

<UniversalSubscriptionProvider
  config={{
    merchant: "0xYourReceivingAddress",
    // magicKey, particle keys, price, chain, settlement token… all optional
  }}
>
  <App />
</UniversalSubscriptionProvider>;
```

```tsx
// 2. Read the hooks anywhere

// One-time buy (storefront) — pay any amount from the unified balance:
import { useCheckout } from "@/hooks/useCheckout";
const { checkout, charging, stage } = useCheckout();
await checkout(0.1); // charges $0.10 to the merchant, cross-chain if needed

// Or recurring (subscription):
import { useSubscription } from "@/hooks/useSubscription";
const { chargeSubscription, cancelSubscription, subscriptionActive } =
  useSubscription();
```

Both charge shapes sit on the same core — `useUniversalUpgrade` (email EOA →
Universal Account + unified cross-chain balance). The reusable core is
`components/UniversalSubscriptionProvider` + `hooks/*` + `lib/magic.ts`; the
public surface is re-exported from [`index.ts`](./index.ts).

---

## Quick start

```bash
git clone https://github.com/alexursol2/Click_UXmaxx_Hackathon click && cd click
npm install
cp .env.example .env.local     # paste your keys (below)
npm run dev                     # → http://localhost:3000
```

### Keys you need

All are **publishable, client-side** keys (safe in the browser bundle) — hence
the `NEXT_PUBLIC_` prefix. **Never** put secret/server keys here.

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_MAGIC_KEY` | [Magic dashboard](https://dashboard.magic.link) (`pk_live_…`) |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` / `_CLIENT_KEY` / `_APP_ID` | [Particle dashboard](https://dashboard.particle.network) |
| `NEXT_PUBLIC_MERCHANT_ADDRESS` | where payments land — an address you control |

---

## How it works

```
 ┌──────────────┐   email OTP    ┌──────────────────┐    EIP-7702    ┌─────────────────────┐
 │ Magic wallet  │ ─────────────▶ │ useUniversal-     │ ─────────────▶ │ Particle Universal   │
 │ (EOA, no seed │  headless sign │ Upgrade()         │   type-4 tx    │ Account: one unified │
 │ phrase)       │                │ = the product     │                │ cross-chain balance  │
 └──────────────┘                └──────────────────┘                └─────────────────────┘
```

- **Magic** turns an email into a non-custodial embedded wallet. Signing is
  **headless** (no popups) — which is what makes recurring billing feel like a
  normal SaaS. It also signs the EIP-7702 authorization (`sign7702Authorization`).
- **Particle Universal Accounts (SDK v2)** abstracts balances across chains into
  one number and one place to spend from — EVM chains **and Solana**.
- **EIP-7702** upgrades the plain email EOA into that Universal Account. The
  authorization rides along with the first transaction — no separate setup tx.

Supported source tokens: **ETH, USDC, USDT, BNB, SOL**. Supported chains:
**Ethereum, Base, Arbitrum, BNB Chain, XLayer, Solana**.

---

## The charge flow

On Particle's v2 backend a **transfer** only spends tokens already on the
settlement chain; cross-chain sourcing is a **Convert** that rebalances your
assets first. Both `checkout()` (one-time) and `chargeSubscription()` (recurring)
run the same engine end to end:

```
transfer ── funds already on settlement chain? ──▶ settle ✓
   │ no ("Insufficient primary token balance")
   ▼
convert (any chain → settlement chain) ──▶ wait for on-chain settlement
   ▼                                              │ transfer fails here?
transfer ──▶ wait for on-chain settlement         ▼
   ▼                                        PARTIAL: funds moved, unpaid.
"Pro active"                                Retry RESUMES at transfer —
                                            never converts (or pays) twice.
```

Two invariants are baked in:

1. **`sendTransaction` resolving ≠ money moved.** Cross-chain settlement is
   asynchronous; `waitForSettlement()` polls until terminal status (7 = FINISHED)
   and the UI never claims success before the chain does.
2. **Subscription state lives on-chain.** On load, the app counts settled
   transfers to the merchant (matched by amount + recency) — "Pro" survives
   reloads with no backend, because the chain is the database.

---

## Solana → Arbitrum

The interesting discovery: **paying from Solana needs no separate Solana signer.**
Particle's own examples (`transfer-solana.ts`, `convert-solana.ts`) sign every
Solana action with **only the EVM owner's root-hash signature**
(`sendTransaction(tx, wallet.signMessage(getBytes(tx.rootHash)))`). The UA's
Solana smart account is authorised by the EVM owner — the exact path this app
already has.

So Solana sourcing works through the existing code. The only UI addition was
surfacing the **Solana deposit address** (`getSmartAccountOptions().solanaSmartAccountAddress`)
in "how to add funds?". A charge whose funds sit on Solana sources them via the
Convert path, root-hash signed. **Verified on mainnet** (SOL on Solana →
USDC to a merchant on Arbitrum, convert fee ≈ $0.12).

---

## Why this is technically hard

Chain abstraction looks like one number and one button. What makes it real is
everything underneath. This project paid for these lessons on mainnet:

- **Settlement is not submission** — poll to a terminal status before trusting success.
- **Transfers only spend the settlement chain** — "pay $X on Arbitrum from ETH on Base"
  is Convert → wait → transfer → wait, not one call.
- **A cross-chain charge can half-complete** — Convert settles, transfer fails, money's
  moved and merchant unpaid. The app detects it and its retry **resumes at the transfer**,
  never converting/paying twice.
- **Error codes are ambiguous** — Particle reuses `-32653` for both "insufficient on the
  settlement chain" (needs a Convert) and a transient busy bundler. The **message** has to
  win over the code, or a Solana-only balance can never pay. (`lib/utils.ts` → `classifyError`.)
- **Buffers are a guess; quotes are truth** — the Convert is sized against a live quote so
  the amount that actually arrives covers price + settlement-chain gas.
- **7702 delegation is per-chain** — delegating on Base doesn't delegate on Arbitrum; each
  chain the account touches carries its own authorization on the first tx.
- **Recurring on mainnet burns real money** — a low-balance guard pauses billing before it
  can drain the wallet; the cross-chain fee is previewed before a charge.

---

## Configuration

Everything is env-driven (and injectable via the provider `config` prop):

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_SUBSCRIPTION_PRICE_USD` | `5` | Price when settling in USDC |
| `NEXT_PUBLIC_SUBSCRIPTION_TOKEN` | `usdc` | Settlement token: `usdc` \| `eth` \| `sol` |
| `NEXT_PUBLIC_SUBSCRIPTION_PRICE_ETH` / `_SOL` | `0.001` / `0.01` | Price when settling in ETH / SOL |
| `NEXT_PUBLIC_SUBSCRIPTION_CHAIN_ID` | `42161` | Settlement chain (EVM); `sol` forces Solana (101) |
| `NEXT_PUBLIC_MERCHANT_ADDRESS` / `_SOL` | — | Merchant (EVM / Solana) |
| `NEXT_PUBLIC_BILLING_INTERVAL_SECONDS` | `0` | >0 compresses billing for a live demo |
| `NEXT_PUBLIC_BILLING_MAX_CYCLES` | `12` | Cap on auto-charges (a year of monthly) |
| `NEXT_PUBLIC_CONVERT_BUFFER_USD` / `_ETH` | `0.4` / `0.0002` | Cross-chain headroom floor |
| `NEXT_PUBLIC_CONVERT_GAS_FLOOR_USD` | `0.05` | Min settlement-chain gas to over-convert for |
| `NEXT_PUBLIC_LOW_BALANCE_STOP_USD` | `0.5` | Pause auto-billing below `price + this` |

**Subscription model (demo default):** $0.10 / month, renews monthly, up to 12
cycles (a year), **cancel anytime**. Cancel turns off auto-renew and keeps
access until the period ends (persisted per wallet).

---

## Project structure

```
app/                            # Next.js App Router
  layout.tsx · page.tsx         #   fonts + providers; page renders the storefront
  globals.css · onlycrabs.css   #   Click theme; storefront styles (scoped .oc-root)
index.ts                        # ★ public library API (barrel)
components/
  UniversalSubscriptionProvider #   config injection (env defaults or props)
  StoreProvider                 #   shared session: checkout + auth + buy/login gate
  Storefront                    #   OnlyCrabs demo: products, cart, one-click pay, status
  AccountModal                  #   Account panel: login, then balance + pay-with + history
  UniversalBalanceCard          #   unified balance, EVM+Solana addresses, holdings
  ChargeProgress                #   live charge stepper
  BillingHistory                #   on-chain receipts drawer + total fees
  ProDashboard · SubscriptionBar#   subscription demo UI (recurring; library feature)
  LoginCard · Button · icons · TokenIcon · PayWithSelector
hooks/
  useUniversalUpgrade.ts        # ★ the core: upgrade, unified balance,
                                #   transfer/convert/quote, settlement polling, history
  useCheckout.ts                #   one-time, dynamic-amount charge (the storefront)
  useSubscription.ts            #   recurring charge, on-chain Pro state, demo billing
  useHoverable.ts               #   hover on desktop, tap on mobile
lib/
  magic.ts                      #   email login, ethers signer, 7702 signature adapter
  config.ts                     #   env → typed config (chain, price, tokens, guards)
  subscriptionConfig.ts         #   the injectable config type + configFromEnv()
  feeLedger.ts                  #   local fee record (Particle history has no fees)
  chains.ts · utils.ts          #   chain names, formatting, classifyError
scripts/                        #   read-only diagnostics (no keys, no spend):
  check-account.mjs · tx-list.mjs · probe-*.mjs · fees.mjs
```

The `scripts/` diagnostics are worth a mention: quotes are free (nothing is
signed), so you can probe routing, fees, and balances **with only a public
address** — `node --env-file=.env.local scripts/check-account.mjs 0xYourAddress`.

---

## Public API

Re-exported from [`index.ts`](./index.ts):

- `UniversalSubscriptionProvider`, `useSubscriptionConfig`, `configFromEnv`, `UniversalSubscriptionConfig`
- `useUniversalUpgrade` + types (`UniversalBalance`, `TransferInput`, `HistoryEntry`)
- `useCheckout` + types (`UseCheckout`, `CheckoutResult`) — one-time charge
- `useSubscription` + types (`PayWith`, `AvailableToken`, `ChargeStage`) — recurring
- `classifyError`, `friendlyError`, `ClassifiedError`

---

## Deploy

Stock Next.js App Router app — Vercel auto-detects it.

1. Push to GitHub, import the repo in Vercel.
2. Add your `NEXT_PUBLIC_*` variables in **Settings → Environment Variables**.
3. Deploy. No build config required.

---

## Roadmap

- **Session keys** so recurring billing runs merchant-initiated (no open session) with an on-chain spend policy.
- **Card on-ramp** via `@particle-network/universal-deposit` (deposit into the UA from any chain + Stripe/Coinbase).
- **More settlement chains**, and Solana-settled merchants.

---

## Notes

- Requires `@particle-network/universal-account-sdk` **v2+** (v1's backend was sunset June 2026).
- Mainnet flows are meant to be tested with your own keys + funds; the code never executes transactions on its own.
- Stack: Next.js 15.5, React 19, TypeScript 5, Tailwind v4, ethers v6, magic-sdk 33, Quicksand font.

🤖 Built with [Claude Code](https://claude.com/claude-code)
