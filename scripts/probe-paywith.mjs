import { UniversalAccount, SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
const owner = process.argv[2];
const M = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
const mk = (tc) => new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: owner },
  tradeConfig: { slippageBps: 100, ...tc },
});

console.log("=== 1) history row: does it expose a FEE field? ===");
try {
  const res = await mk({}).getTransactions(1, 3);
  const row = (res?.data ?? [])[0];
  if (row) console.log("row keys:", Object.keys(row).join(", "));
  if (row) console.log("fee-ish:", JSON.stringify({
    gasFeeInUSD: row.gasFeeInUSD, feeInUSD: row.feeInUSD, totalFeeInUSD: row.totalFeeInUSD,
    fees: row.fees, feeQuotes: row.feeQuotes ? "present" : undefined,
    userOpGas: row.userOps?.map?.(u=>u.gasFeeInUSD),
  }));
} catch (e) { console.log("history failed:", e?.message); }

console.log("\n=== 2) transfer quote fee (createTransferTransaction, USDC@Arb $2) ===");
try {
  const tx = await mk({}).createTransferTransaction({ token: { chainId: 42161, address: USDC_ARB }, amount: "2", receiver: M });
  const t = tx.feeQuotes?.[0]?.fees?.totals;
  console.log("transfer fee:", f(t?.feeTokenAmountInUSD), "| gas:", f(t?.gasFeeTokenAmountInUSD), "| tokenChanges.totalFeeInUSD:", tx.tokenChanges?.totalFeeInUSD);
} catch (e) { console.log("transfer quote failed:", e?.code, e?.message?.slice(0,50)); }

console.log("\n=== 3) usePrimaryTokens on CONVERT: force ETH vs USDC source ===");
for (const [label, prim] of [["auto", undefined], ["ETH only", [SUPPORTED_TOKEN_TYPE.ETH]], ["USDC only", [SUPPORTED_TOKEN_TYPE.USDC]]]) {
  try {
    const tx = await mk(prim ? { usePrimaryTokens: prim } : {}).createConvertTransaction(
      { chainId: 42161, expectToken: { type: SUPPORTED_TOKEN_TYPE.USDC, amount: "0.5" } }
    );
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    const src = (tx.tokenChanges?.decr ?? []).map(d => `${d.token?.symbol}@${d.token?.chainId}`).join(",");
    console.log(`  ${label.padEnd(9)} → source[${src}] fee=${f(t?.feeTokenAmountInUSD)}`);
  } catch (e) { console.log(`  ${label.padEnd(9)} → FAIL ${e?.code} ${e?.message?.slice(0,40)}`); }
}
