import { UniversalAccount, SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
const owner = process.argv[2];
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: owner },
  tradeConfig: { slippageBps: 100 },
});
const hexUsd = (h) => { try { return Number(BigInt(h)) / 1e18; } catch { return null; } };
const CH = {8453:"Base",42161:"Arbitrum"};
async function dump(label, tx) {
  const tc = tx.tokenChanges ?? {};
  const src = (tc.decr ?? []).map(d => `${d.token?.symbol}@${CH[d.token?.chainId]??d.token?.chainId}`).join(",");
  const feeQuoteHex = tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD;
  const incrHex = (tc.incr ?? []).map(i => i.amountInUSD);
  console.log(`\n[${label}] source=[${src}]`);
  console.log("  tokenChanges.totalFeeInUSD    :", JSON.stringify(tc.totalFeeInUSD), "→ Number:", Number(tc.totalFeeInUSD));
  console.log("  tokenChanges.totalIncrInUSD   :", JSON.stringify(tc.totalIncrAmountInUSD), "→ Number:", Number(tc.totalIncrAmountInUSD));
  console.log("  feeQuotes[0].feeTokenAmtUSD   :", JSON.stringify(feeQuoteHex), "→ hexUsd:", hexUsd(feeQuoteHex));
  console.log("  incr[].amountInUSD            :", JSON.stringify(incrHex), "→ hexUsd:", incrHex.map(hexUsd));
}
// per-call tradeConfig test
for (const [label, prim] of [["convert auto", undefined], ["convert ETH-only (per-call)", [SUPPORTED_TOKEN_TYPE.ETH]]]) {
  try {
    const tx = await ua.createConvertTransaction(
      { chainId: 42161, expectToken: { type: SUPPORTED_TOKEN_TYPE.USDC, amount: "0.5" } },
      prim ? { usePrimaryTokens: prim } : undefined
    );
    await dump(label, tx);
  } catch (e) { console.log(`\n[${label}] FAIL ${e?.code} ${e?.message?.slice(0,40)}`); }
}
