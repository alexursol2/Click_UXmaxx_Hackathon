import { UniversalAccount } from "@particle-network/universal-account-sdk";
const CH = {1:"Ethereum",10:"OP",8453:"Base",42161:"Arbitrum"};
const nm = (a=[]) => a.map(c => CH[c] ?? c).join("+") || "-";
const [address, ...amounts] = process.argv.slice(2);
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
for (const amount of amounts) {
  try {
    const tx = await ua.createTransferTransaction({
      token: { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
      amount, receiver: process.env.NEXT_PUBLIC_MERCHANT_ADDRESS,
    });
    const tc = tx.tokenChanges ?? {};
    console.log(`✓ $${amount.padEnd(5)} ${nm(tc.fromChains)} -> ${nm(tc.toChains)} | swaps:${(tc.swaps??[]).length} | fee $${tc.totalFeeInUSD ?? "?"}`);
  } catch (e) {
    console.log(`✗ $${amount.padEnd(5)} ${(e?.message ?? e).toString().slice(0,60)}`);
  }
}
