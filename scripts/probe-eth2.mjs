import { UniversalAccount } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const M = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
const ZERO = "0x0000000000000000000000000000000000000000";
const mk = (tc) => new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, ...tc },
});
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
const cases = [
  ["ETH@Base SAME-chain, universalGas:true ", 8453,  { universalGas: true }],
  ["ETH@Base SAME-chain, universalGas:false", 8453,  { universalGas: false }],
  ["ETH@Arb  CROSS-chain, universalGas:false", 42161, { universalGas: false }],
];
for (const [label, chainId, tc] of cases) {
  try {
    const tx = await mk(tc).createTransferTransaction({ token: { chainId, address: ZERO }, amount: "0.0005", receiver: M });
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    console.log(`✓ ${label} 0.0005 ETH (~$0.94)  fee=${f(t?.feeTokenAmountInUSD)}`);
  } catch (e) {
    console.log(`✗ ${label} 0.0005 ETH  ${(e?.message ?? e).toString().slice(0,50)}`);
  }
}
