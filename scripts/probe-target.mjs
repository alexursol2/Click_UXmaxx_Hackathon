import { UniversalAccount } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const MERCHANT = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
const USDC_ARB  = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
const cases = [
  ["USDC@Base  (SAME chain as funds)", 8453,  USDC_BASE, "0.01"],
  ["USDC@Base  (same chain)",          8453,  USDC_BASE, "0.005"],
  ["USDC@Arb   (CROSS chain)",         42161, USDC_ARB,  "0.01"],
];
for (const [label, chainId, token, amount] of cases) {
  try {
    const tx = await ua.createTransferTransaction({ token: { chainId, address: token }, amount, receiver: MERCHANT });
    const totals = tx.feeQuotes?.[0]?.fees?.totals;
    console.log(`✓ ${label.padEnd(34)} $${amount.padEnd(6)} gasFee=${f(totals?.gasFeeTokenAmountInUSD)} totalFee=${f(totals?.feeTokenAmountInUSD)}`);
  } catch (e) {
    console.log(`✗ ${label.padEnd(34)} $${amount.padEnd(6)} ${(e?.message ?? e).toString().slice(0,55)}`);
  }
}
