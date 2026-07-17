/**
 * Read-only account diagnostic. Takes a PUBLIC address — no private key, no
 * signing, no transactions. It only reads chain + Particle state.
 *
 * Usage:
 *   node --env-file=.env.local scripts/check-account.mjs 0xYourAddress
 *
 * Reports:
 *   1. Native ETH + USDC balance on Arbitrum (did your funding land?)
 *   2. EIP-7702 delegation status via eth_getCode (has the upgrade committed?)
 *   3. Particle's unified cross-chain balance via getPrimaryAssets()
 */

import { JsonRpcProvider, Contract, formatUnits, formatEther } from "ethers";
import { UniversalAccount } from "@particle-network/universal-account-sdk";

const CHAIN_NAMES = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum One",
  43114: "Avalanche",
  59144: "Linea",
  101: "Solana",
};

const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const address = process.argv[2];
if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error("Usage: node --env-file=.env.local scripts/check-account.mjs 0xAddress");
  process.exit(1);
}

const line = (s = "") => console.log(s);

line(`\nChecking ${address} on Arbitrum One\n${"─".repeat(60)}`);

// --- 1 & 2: raw chain reads -------------------------------------------------
const provider = new JsonRpcProvider(ARBITRUM_RPC);

const [eth, code] = await Promise.all([
  provider.getBalance(address),
  provider.getCode(address),
]);

const usdc = new Contract(USDC, ERC20_ABI, provider);
const usdcBal = await usdc.balanceOf(address);

line("\n1. Funding (Arbitrum One)");
line(`   ETH  : ${formatEther(eth)}`);
line(`   USDC : ${formatUnits(usdcBal, 6)}`);
if (usdcBal === 0n) {
  line("   ⚠ No USDC here yet — the subscription charge will fail.");
}

line("\n2. EIP-7702 delegation");
if (code === "0x") {
  line("   Not delegated yet (expected before the first charge).");
} else {
  const isDelegation = code.startsWith("0xef0100");
  line(`   Code present (${code.length - 2} hex chars)`);
  line(
    isDelegation
      ? `   ✓ 7702 delegation active → implementation ${"0x" + code.slice(8)}`
      : "   Contract code present, but not a 7702 delegation indicator."
  );
}

// --- 3: Particle's unified balance (read-only) ------------------------------
line("\n3. Particle unified balance (getPrimaryAssets)");
const { NEXT_PUBLIC_PARTICLE_PROJECT_ID, NEXT_PUBLIC_PARTICLE_CLIENT_KEY, NEXT_PUBLIC_PARTICLE_APP_ID } =
  process.env;

if (!NEXT_PUBLIC_PARTICLE_PROJECT_ID || !NEXT_PUBLIC_PARTICLE_CLIENT_KEY || !NEXT_PUBLIC_PARTICLE_APP_ID) {
  line("   Skipped — run with: node --env-file=.env.local scripts/check-account.mjs …");
} else {
  try {
    const ua = new UniversalAccount({
      projectId: NEXT_PUBLIC_PARTICLE_PROJECT_ID,
      projectClientKey: NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
      projectAppUuid: NEXT_PUBLIC_PARTICLE_APP_ID,
      smartAccountOptions: { useEIP7702: true, ownerAddress: address },
      tradeConfig: { slippageBps: 100, universalGas: true },
    });

    const assets = await ua.getPrimaryAssets();
    line(`   Total across all chains: $${(assets.totalAmountInUSD ?? 0).toFixed(4)}`);
    for (const a of assets.assets ?? []) {
      if (a.amountInUSD > 0) {
        line(`     ${a.tokenType.toUpperCase().padEnd(5)} $${a.amountInUSD.toFixed(4)}`);
        // Per-chain breakdown: where the money actually sits.
        for (const agg of a.chainAggregation ?? []) {
          if (agg.amountInUSD > 0) {
            const cid = agg.token?.chainId;
            line(
              `        └─ ${(CHAIN_NAMES[cid] ?? `chain ${cid}`).padEnd(14)} $${agg.amountInUSD.toFixed(4)}`
            );
          }
        }
      }
    }
    if (!(assets.totalAmountInUSD > 0)) {
      line("   ⚠ Particle sees $0 — funds may not have landed, or not at this address.");
    }
  } catch (e) {
    line(`   ✗ Particle read failed: ${e?.message ?? e}`);
  }
}

line(`\n${"─".repeat(60)}\n`);
