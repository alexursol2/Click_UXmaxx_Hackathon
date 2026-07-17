import { JsonRpcProvider, formatEther } from "ethers";
const HASH = process.argv[2];
const chains = [
  ["Arbitrum One", "https://arb1.arbitrum.io/rpc"],
  ["Base", "https://mainnet.base.org"],
];
for (const [name, url] of chains) {
  try {
    const p = new JsonRpcProvider(url);
    const tx = await p.getTransaction(HASH);
    if (!tx) { console.log(`${name.padEnd(13)}: not found`); continue; }
    const r = await p.getTransactionReceipt(HASH);
    console.log(`\n${name}: FOUND`);
    console.log(`  type   : ${tx.type} ${tx.type === 4 ? "(EIP-7702 set-code)" : ""}`);
    console.log(`  from   : ${tx.from}`);
    console.log(`  to     : ${tx.to}`);
    console.log(`  value  : ${formatEther(tx.value ?? 0n)} ETH`);
    console.log(`  status : ${r ? (r.status === 1 ? "SUCCESS" : "REVERTED") : "pending"}`);
    if (r) console.log(`  gasUsed: ${r.gasUsed} | block ${r.blockNumber} | logs: ${r.logs.length}`);
  } catch (e) {
    console.log(`${name.padEnd(13)}: rpc error — ${e.shortMessage ?? e.message}`);
  }
}
