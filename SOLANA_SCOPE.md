# Solana integration — scope

## ✅ RESOLVED (2026-07-18) via `Particle-Network/universal-account-example`

The signing question is answered. `examples/transfer-solana.ts`,
`convert-solana.ts`, and `custom-transaction-solana-with-money.ts` all source
from / act on Solana and sign with **only the EVM owner's root-hash signature**:
`sendTransaction(tx, wallet.signMessage(getBytes(tx.rootHash)))`. **No separate
Solana signer, no `@magic-ext/solana`, no `createMultiChainUnsignedData`.** The UA's
Solana smart account is authorised by the EVM owner signature — the exact path we
already have (`signAndSend` → `signRootHash`).

**So Solana sourcing already works through our existing code.** All that was missing
was surfacing the **Solana deposit address** (`getSmartAccountOptions().solanaSmartAccountAddress`)
so users can deposit SOL/USDC-SPL — now shown in "how to add funds?". A charge whose
funds sit on Solana sources them via the existing Convert path (root-hash signed).

Residual caveat: examples use classic AA (`useEIP7702:false`); we use 7702. The
Solana smart account exists in 7702 mode (verified) and signing is identical, but a
real 7702+Solana end-to-end charge hasn't been executed (no SOL in a test wallet yet).

---

## (original scope, now largely answered)


Goal: let the unified balance be **sourced from Solana** too (deposit SOL / USDC-SPL
on Solana, spend it toward the EVM subscription). Today the account signs EVM
only; Solana holdings show in the balance but can't fund a charge.

## What's already true (verified)

- Particle v2 lists **SOL** as a primary token and **Solana (chainId 101)** as a
  supported chain (`UNIVERSAL_ACCOUNT_VERSION_V2_SUPPORTED_TOKEN_TYPES` /
  `_SUPPORTED_CHAIN_IDS`).
- `getPrimaryAssets()` already returns SOL in the unified balance when the account
  holds it, and `getSmartAccountOptions()` returns a **`solanaSmartAccountAddress`**.
- The SDK exposes Solana signing primitives:
  `createMultiChainUnsignedData(multiChainUserOps)`,
  `injectMultiChainSignature(tx, signature, authorizations)`, `serializeInstruction`,
  and the transaction's `userOps` can be **`IUserOpSolana`** (own `signature` field,
  `credentialId`, `metaAddress`, `insArgs`, …).
- **Magic supports Solana** via `@magic-ext/solana` + `@solana/web3.js`: the same
  email login yields a Solana keypair/address (ed25519), separate from the EVM one.

## The real work (and the unknowns)

1. **Solana signer from Magic** — add `@magic-ext/solana`, init a Magic Solana
   instance (or extension), expose `getSolanaAddress()` and a `signSolanaMessage`/
   `signTransaction`. _Confidence: high (standard Magic)._
2. **Owner mapping** — does Particle's `solanaSmartAccountAddress` derive from the
   **Magic Solana public key**, and how is that owner passed to `UniversalAccount`?
   The constructor takes an EVM `ownerAddress`; Solana ownership wiring is unclear.
   _⚠ Unknown — needs Particle Solana docs/example._
3. **Signing the Solana userOp** — when a charge sources from Solana, `tx.userOps`
   contains an `IUserOpSolana`. The exact flow to sign it (what
   `createMultiChainUnsignedData` returns, what bytes the Solana key signs, how
   `injectMultiChainSignature` expects the combined EVM+Solana signature) is
   **`any`-typed and undocumented**. _⚠ Unknown — must read a reference, not guess._
4. **Send path** — likely `injectMultiChainSignature(tx, evmSig, auths)` for the
   EVM leg + a Solana signature injected into the Solana userOp, then
   `sendTransaction`. Needs confirmation.

## Blockers before writing code (don't invent)

- Particle's **Solana Universal Accounts** doc/quickstart URL, or a reference repo
  like `Particle-Network/universal-accounts-7702` but for Solana. With that, the
  signing shape in (3) becomes concrete and this is buildable.
- Confirm whether the EVM Magic wallet and a Magic Solana wallet can coexist for
  one email session, and which address Particle treats as the Solana owner.

## Re: `Particle-Network/universal-deposit` (checked 2026-07-18)

That repo is the **`@particle-network/universal-deposit` SDK (v0.1.0)** — it
**deposits funds INTO a UA from any chain (EVM + Solana) + fiat onramp**
(Stripe/Coinbase). Its Solana path (`funding/solana-transfer.ts`) is a **plain
Solana transfer** from a browser wallet (Phantom) to the UA's **Solana deposit
address**. It runs the UA in **`useEIP7702: false`** (classic AA, stable deposit
addresses). It does **NOT** use `createMultiChainUnsignedData` /
`injectMultiChainSignature` — so it is **not** the spend-from-Solana signing
reference. Two implications:

- **For "Add funds"** (deposit SOL / from any chain / by card): this SDK is the
  right tool and beats the Openfort idea. But it assumes classic-AA deposit
  addresses (`useEIP7702:false`); our app is 7702, so mode-compat must be checked,
  and it's an early (0.1.0) SDK + pulls in `@solana/web3.js`.
- **For "spend from Solana in a charge"**: still need the multi-chain signing
  reference (not in this repo).

## Suggested next step

Paste the Particle **Solana UA** doc URL (or point me at their Solana example repo)
and I'll read the real signing flow — same approach that unblocked the EIP-7702
integration — then implement `lib/solana.ts` (Magic Solana signer) + a Solana
branch in `useUniversalUpgrade`'s send path, non-breaking to the current EVM flow.

## Deps to add (when unblocked)

`@magic-ext/solana`, `@solana/web3.js` (already a transitive dep of the Particle SDK).
