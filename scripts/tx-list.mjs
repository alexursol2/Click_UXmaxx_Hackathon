import { UniversalAccount } from "@particle-network/universal-account-sdk";
const CH = {1:"Ethereum",10:"OP",8453:"Base",42161:"Arbitrum",56:"BNB",137:"Polygon"};
const nm = (a=[]) => a.map(c => CH[c] ?? c).join("+") || "-";
for (const address of process.argv.slice(2)) {
  const ua = new UniversalAccount({
    projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
    projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
    projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
    smartAccountOptions: { useEIP7702: true, ownerAddress: address },
    tradeConfig: { slippageBps: 100, universalGas: true },
  });
  console.log(`\n===== ${address} =====`);
  try {
    const res = await ua.getTransactions(1, 20);
    const rows = res?.data ?? [];
    if (!rows.length) console.log("  (no transactions)");
    for (const t of rows) {
      console.log(
        `  ${t.createdAt}  status=${String(t.status).padEnd(3)} ${String(t.change?.amount).padEnd(7)} ` +
        `${nm(t.fromChains)} -> ${nm(t.toChains)}  tag=${t.tag}  id=${t.transactionId}`
      );
    }
  } catch (e) { console.log("  failed:", e?.message ?? e); }
}
