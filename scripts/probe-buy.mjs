import { UniversalAccount } from "@particle-network/universal-account-sdk";
const address = process.argv[2];
const ua = new UniversalAccount({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  smartAccountOptions: { useEIP7702: true, ownerAddress: address },
  tradeConfig: { slippageBps: 100, universalGas: true },
});
const f = (h) => h == null ? "n/a" : "$" + (Number(BigInt(h)) / 1e18).toFixed(4);
const CH = {8453:"Base",42161:"Arbitrum"};
const cases = [
  ["BUY  $2 USDC on Arbitrum (cross)", () => ua.createBuyTransaction({ token: { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" }, amountInUSD: "2" })],
  ["BUY  $2 USDT on Arbitrum (cross)", () => ua.createBuyTransaction({ token: { chainId: 42161, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" }, amountInUSD: "2" })],
  ["BUY  $1 USDC on Base (same)",      () => ua.createBuyTransaction({ token: { chainId: 8453,  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, amountInUSD: "1" })],
];
for (const [label, run] of cases) {
  try {
    const tx = await run();
    const t = tx.feeQuotes?.[0]?.fees?.totals;
    const tc = tx.tokenChanges ?? {};
    const from = (tc.fromChains??[]).map(c=>CH[c]??c).join("+");
    const to = (tc.toChains??[]).map(c=>CH[c]??c).join("+");
    console.log(`✓ ${label}  route ${from}->${to}  fee=${f(t?.feeTokenAmountInUSD)}  swaps=${(tc.swaps??[]).length}`);
  } catch (e) {
    console.log(`✗ ${label}  code=${e?.code}  ${(e?.message ?? e).toString().slice(0,45)}`);
  }
}
