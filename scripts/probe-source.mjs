import { UniversalAccount, SUPPORTED_TOKEN_TYPE, PREFER_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const M = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
const mk = (tc) => new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true, ...tc },
});
const configs = [
  ["default", {}],
  ["usePrimaryTokens:[ETH]", { usePrimaryTokens: [SUPPORTED_TOKEN_TYPE.ETH] }],
  ["usePrimaryTokens:[ETH,USDC]", { usePrimaryTokens: [SUPPORTED_TOKEN_TYPE.ETH, SUPPORTED_TOKEN_TYPE.USDC] }],
  ["preferTokenType:ETH", { preferTokenType: PREFER_TOKEN_TYPE?.ETH }],
];
for (const [label, tc] of configs) {
  try {
    const tx = await mk(tc).createTransferTransaction({ token: { chainId: 42161, address: USDC_ARB }, amount: "2", receiver: M });
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    console.log(`✓ ${label.padEnd(30)} fee=${f(t?.feeTokenAmountInUSD)} swaps=${(tx.tokenChanges?.swaps??[]).length}`);
  } catch (e) {
    console.log(`✗ ${label.padEnd(30)} ${(e?.message ?? e).toString().slice(0,50)}`);
  }
}
