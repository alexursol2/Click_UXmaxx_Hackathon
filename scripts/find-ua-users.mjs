import { JsonRpcProvider } from "ethers";
const base = new JsonRpcProvider("https://mainnet.base.org");
const IMPL = "6640c1cccaf07dbe765ec05e294fe427cc92831c";
const r = await base.getTransactionReceipt("0x1de5438a669d50614a1684ad8adaa0bb711c2f100620aba9e8e25c1ac1ebcd57");
const cands = new Set();
for (const log of r?.logs ?? []) {
  cands.add(log.address);
  for (const t of log.topics) {
    if (/^0x000000000000000000000000[0-9a-fA-F]{40}$/.test(t)) cands.add("0x" + t.slice(26));
  }
}
console.log(`candidates from bundler tx: ${cands.size}`);
let n = 0;
for (const a of cands) {
  const code = await base.getCode(a).catch(() => "0x");
  if (code.toLowerCase() === ("0xef0100" + IMPL).toLowerCase()) {
    const bal = await base.getBalance(a);
    console.log(`DELEGATED UA: ${a}  base=${Number(bal)/1e18} ETH`);
    if (++n >= 6) break;
  }
}
if (!n) console.log("no delegated UA accounts found in this tx");
