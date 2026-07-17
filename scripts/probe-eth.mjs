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
// Native ETH on Arbitrum, sourced from ETH on Base. Amounts in ETH (~$1872/ETH):
for (const amount of ["0.0002", "0.0005", "0.001", "0.0015", "0.002"]) {
  const usd = (Number(amount) * 1872).toFixed(2);
  try {
    const tx = await ua.createTransferTransaction({ token: { chainId: 42161, address: ZERO }, amount, receiver: M });
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    console.log(`✓ ${amount} ETH (~$${usd})  fee=${f(t?.feeTokenAmountInUSD)}  swaps=${(tx.tokenChanges?.swaps??[]).length}`);
  } catch (e) {
    console.log(`✗ ${amount} ETH (~$${usd})  ${(e?.message ?? e).toString().slice(0,50)}`);
  }
}
