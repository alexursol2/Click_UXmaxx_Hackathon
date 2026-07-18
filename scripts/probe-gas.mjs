import { UniversalAccount, SUPPORTED_TOKEN_TYPE, PREFER_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
const owner = process.argv[2];
const hexUsd = (h) => { try { return Number(BigInt(h)) / 1e18; } catch { return typeof h === "string" ? Number(h)||0 : 0; } };
const mk = (tc) => new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: owner },
  tradeConfig: { slippageBps: 100, ...tc },
});
const fee = (tx) => hexUsd(tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD);
const feeTokens = (tx) => (tx.feeQuotes?.[0]?.fees?.feeTokens ?? []).map(f => `${f.token?.symbol}@${f.token?.chainId}`).join(",");
const CH = {8453:"Base",42161:"Arbitrum"};
// Cross-chain convert (Base ETH -> USDC@Arbitrum) — compare fee-token preference
for (const [label, tc] of [
  ["default (USD prefer)         ", {}],
  ["preferTokenType: USD         ", { preferTokenType: PREFER_TOKEN_TYPE.USD }],
  ["preferTokenType: NATIVE (ETH)", { preferTokenType: PREFER_TOKEN_TYPE.NATIVE }],
]) {
  try {
    const tx = await mk(tc).createConvertTransaction({ chainId: 42161, expectToken: { type: SUPPORTED_TOKEN_TYPE.USDC, amount: "0.3" } });
    console.log(`${label}  fee=$${fee(tx).toFixed(4)}  feeTokens=[${feeTokens(tx)}]`);
  } catch (e) { console.log(`${label}  FAIL ${e?.code} ${e?.message?.slice(0,40)}`); }
}
