import { UniversalAccount } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const M = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
const ZERO = "0x0000000000000000000000000000000000000000";
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
const cases = [
  ["USDC @ Base    (funds here)", 8453,  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
  ["ETH  @ Base    (funds here)", 8453,  ZERO],
  ["USDC @ Arbitrum",             42161, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"],
  ["ETH  @ Arbitrum (native)",    42161, ZERO],
  ["USDC @ Optimism",             10,    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"],
  ["USDC @ Polygon",              137,   "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"],
];
for (const [label, chainId, token] of cases) {
  try {
    const tx = await ua.createTransferTransaction({ token: { chainId, address: token }, amount: "0.01", receiver: M });
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    console.log(`✓ ${label.padEnd(30)} fee=${f(t?.feeTokenAmountInUSD)}`);
  } catch (e) {
    console.log(`✗ ${label.padEnd(30)} ${(e?.message ?? e).toString().slice(0,50)}`);
  }
}
