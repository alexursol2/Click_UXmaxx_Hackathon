import { UniversalAccount } from "@particle-network/universal-account-sdk";
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: process.argv[2] },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
try {
  await ua.createBuyTransaction({ token: { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" }, amountInUSD: "2" });
} catch (e) {
  console.log("FULL MESSAGE:", e?.message);
}
