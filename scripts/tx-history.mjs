import { UniversalAccount } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
try {
  const res = await ua.getTransactions(1, 10);
  console.log(JSON.stringify(res, null, 2).slice(0, 6000));
} catch (e) {
  console.log("getTransactions failed:", e?.message ?? e);
}
