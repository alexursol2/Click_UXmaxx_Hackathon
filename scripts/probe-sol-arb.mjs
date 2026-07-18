import { UniversalAccount, SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
const owner = process.argv[2];
const hexUsd = (h) => { try { return Number(BigInt(h)) / 1e18; } catch { return typeof h==="string"?Number(h)||0:0; } };
const CH = {101:"Solana",1:"Ethereum",8453:"Base",42161:"Arbitrum",56:"BNB",196:"XLayer"};
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: owner },
  tradeConfig: { slippageBps: 100 },
});
const opts = await ua.getSmartAccountOptions();
console.log("EVM UA:", opts.smartAccountAddress, "| Solana UA:", opts.solanaSmartAccountAddress);
const bal = await ua.getPrimaryAssets();
console.log("\n=== balance ($" + (bal.totalAmountInUSD??0).toFixed(4) + ") ===");
for (const a of bal.assets ?? []) if (a.amountInUSD > 0.001) {
  console.log(`  ${a.tokenType.toUpperCase().padEnd(5)} $${a.amountInUSD.toFixed(4)}  [` +
    (a.chainAggregation??[]).filter(c=>c.amountInUSD>0.001).map(c=>`${CH[c.token?.chainId]??c.token?.chainId}:$${c.amountInUSD.toFixed(4)}`).join(", ") + "]");
}
console.log("\n=== convert → USDC on Arbitrum (source from Solana) ===");
for (const amount of ["0.1","0.15","0.2","0.3","0.4"]) {
  try {
    const tx = await ua.createConvertTransaction({ chainId: 42161, expectToken: { type: SUPPORTED_TOKEN_TYPE.USDC, amount } });
    const tc = tx.tokenChanges ?? {};
    const src = (tc.decr??[]).map(d=>`${d.token?.symbol}@${CH[d.token?.chainId]??d.token?.chainId}`).join(",");
    const fee = hexUsd(tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD);
    const arrives = (tc.incr??[]).reduce((s,i)=>s+hexUsd(i.amountInUSD),0);
    console.log(`  ✓ $${amount.padEnd(5)} source[${src}] fee=$${fee.toFixed(4)} arrives=$${arrives.toFixed(4)}`);
  } catch (e) { console.log(`  ✗ $${amount.padEnd(5)} ${e?.code} ${(e?.message??e).toString().slice(0,45)}`); }
}
