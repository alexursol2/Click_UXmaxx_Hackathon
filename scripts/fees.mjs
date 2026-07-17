import { UniversalAccount } from "@particle-network/universal-account-sdk";
const [address, amount] = process.argv.slice(2);
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
const tx = await ua.createTransferTransaction({
  token: { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  amount, receiver: process.env.NEXT_PUBLIC_MERCHANT_ADDRESS,
});
const tc = tx.tokenChanges ?? {};
console.log(`--- $${amount} quote ---`);
console.log("totalPaidAmountInUSD :", tc.totalPaidAmountInUSD);
console.log("totalFeeInUSD        :", tc.totalFeeInUSD);
console.log("totalDecrAmountInUSD :", tc.totalDecrAmountInUSD);
console.log("totalIncrAmountInUSD :", tc.totalIncrAmountInUSD);
console.log("decr (what leaves)   :", JSON.stringify((tc.decr??[]).map(d=>({sym:d.token?.symbol,chain:d.token?.chainId,amt:d.amount,usd:d.amountInUSD}))));
console.log("incr (what arrives)  :", JSON.stringify((tc.incr??[]).map(d=>({sym:d.token?.symbol,chain:d.token?.chainId,amt:d.amount,usd:d.amountInUSD}))));
console.log("swaps                :", (tc.swaps??[]).map(s=>`${s.fromToken?.token?.symbol}@${s.fromToken?.token?.chainId} -> ${s.toToken?.token?.symbol}@${s.toToken?.token?.chainId}`).join(", ") || "(none)");
for (const fq of tx.feeQuotes ?? []) {
  console.log("feeQuote.totals      :", JSON.stringify(fq.fees?.totals));
}
console.log("totalDepositTokenAmountInUSD:", tx.totalDepositTokenAmountInUSD);
