import { UniversalAccount, SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
const CH = {1:"Ethereum",10:"OP",8453:"Base",42161:"Arbitrum"};
const nm = (a=[]) => a.map(c => CH[c] ?? c).join("+") || "-";
const address = process.argv[2];
const MERCHANT = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const configs = [
  ["current (no usePrimaryTokens)", { slippageBps: 100, universalGas: true }],
  ["usePrimaryTokens:[ETH]",        { slippageBps: 100, universalGas: true, usePrimaryTokens: [SUPPORTED_TOKEN_TYPE.ETH] }],
  ["usePrimaryTokens:[ETH,USDC]",   { slippageBps: 100, universalGas: true, usePrimaryTokens: [SUPPORTED_TOKEN_TYPE.ETH, SUPPORTED_TOKEN_TYPE.USDC] }],
];

for (const amount of ["0.01", "0.3"]) {
  for (const [label, tradeConfig] of configs) {
    const ua = new UniversalAccount({
      projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
      projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
      projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
      smartAccountOptions: { useEIP7702: true, ownerAddress: address },
      tradeConfig,
    });
    const tag = `$${amount.padEnd(4)} ${label.padEnd(30)}`;
    try {
      const tx = await ua.createTransferTransaction({
        token: { chainId: 42161, address: USDC_ARB },
        amount, receiver: MERCHANT,
      });
      const tc = tx.tokenChanges ?? {};
      console.log(`✓ ${tag} route ${nm(tc.fromChains)} -> ${nm(tc.toChains)} | fee $${tc.totalFeeInUSD ?? "?"} | paid $${tc.totalPaidAmountInUSD ?? "?"}`);
    } catch (e) {
      console.log(`✗ ${tag} ${(e?.message ?? e).toString().slice(0, 70)}`);
    }
  }
}
