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
  await ua.createTransferTransaction({
    token: { chainId: 42161, address: "0x0000000000000000000000000000000000000000" },
    amount: "0.001",
    receiver: process.env.NEXT_PUBLIC_MERCHANT_ADDRESS,
  });
  console.log("unexpected success");
} catch (e) {
  console.log("name   :", e?.name);
  console.log("code   :", e?.code);
  console.log("message:", e?.message);
  console.log("keys   :", Object.keys(e ?? {}));
  console.log("json   :", JSON.stringify(e, null, 2)?.slice(0, 800));
}
