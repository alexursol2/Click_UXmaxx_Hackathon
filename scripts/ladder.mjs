import { UniversalAccount } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
// USDC on Base. Wallet holds ~$0.02 USDC + ~$0.64 ETH, both on Base.
// <= $0.02 => direct transfer.  > $0.02 => REQUIRES a same-chain ETH->USDC swap.
for (const amount of ["0.01","0.02","0.03","0.05","0.10","0.20","0.30","0.40"]) {
  try {
    const tx = await ua.createTransferTransaction({
      token: { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      amount, receiver: process.env.NEXT_PUBLIC_MERCHANT_ADDRESS,
    });
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    const sw = (tx.tokenChanges?.swaps ?? []).length;
    console.log(`✓ $${amount.padEnd(5)} fee=${f(t?.feeTokenAmountInUSD)} swaps=${sw}`);
  } catch (e) {
    console.log(`✗ $${amount.padEnd(5)} ${(e?.message ?? e).toString().slice(0,52)}`);
  }
}
