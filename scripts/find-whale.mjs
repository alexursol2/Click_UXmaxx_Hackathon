import { JsonRpcProvider, formatEther } from "ethers";
const p = new JsonRpcProvider("https://mainnet.base.org");
const bn = await p.getBlockNumber();
const seen = new Set();
for (let i = 0; i < 4; i++) {
  const b = await p.getBlock(bn - i, true);
  for (const h of (b?.transactions ?? []).slice(0, 40)) {
    const tx = await p.getTransaction(h).catch(() => null);
    if (!tx?.from || seen.has(tx.from)) continue;
    seen.add(tx.from);
    const [bal, code] = await Promise.all([p.getBalance(tx.from), p.getCode(tx.from)]);
    if (code === "0x" && bal > 30000000000000000n) { // > 0.03 ETH, EOA only
      console.log(`${tx.from}  ${formatEther(bal)} ETH`);
      if (seen.size > 2) process.exit(0);
    }
  }
}
