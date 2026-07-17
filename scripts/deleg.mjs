import { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
console.log("SDK UNIVERSAL_ACCOUNT_VERSION:", UNIVERSAL_ACCOUNT_VERSION);
try {
  const d = await ua.getEIP7702Deployments();
  console.log("\ngetEIP7702Deployments():\n", JSON.stringify(d, null, 2).slice(0, 1500));
} catch (e) { console.log("getEIP7702Deployments failed:", e?.message ?? e); }
try {
  const a = await ua.getEIP7702Auth([42161, 8453]);
  console.log("\ngetEIP7702Auth([42161, 8453]):\n", JSON.stringify(a, null, 2).slice(0, 2000));
} catch (e) { console.log("getEIP7702Auth failed:", e?.message ?? e); }
try {
  const o = await ua.getSmartAccountOptions();
  console.log("\ngetSmartAccountOptions():\n", JSON.stringify(o, null, 2));
} catch (e) { console.log("getSmartAccountOptions failed:", e?.message ?? e); }
