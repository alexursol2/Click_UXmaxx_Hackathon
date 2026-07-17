import { JsonRpcProvider, formatEther, Contract } from "ethers";
const base = new JsonRpcProvider("https://mainnet.base.org");
const arb  = new JsonRpcProvider("https://arb1.arbitrum.io/rpc");
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const usdc = new Contract(USDC, ["function balanceOf(address) view returns (uint256)"], arb);
const bn = await base.getBlockNumber();
const seen = new Set();
let found = 0;
for (let i = 0; i < 12 && found < 2; i++) {
  const b = await base.getBlock(bn - i, true);
  for (const h of (b?.transactions ?? []).slice(0, 30)) {
    if (found >= 2) break;
    const tx = await base.getTransaction(h).catch(() => null);
    if (!tx?.from || seen.has(tx.from)) continue;
    seen.add(tx.from);
    const [bBal, code] = await Promise.all([base.getBalance(tx.from), base.getCode(tx.from)]);
    if (code !== "0x" || bBal < 20000000000000000n) continue; // EOA, >0.02 ETH on Base
    const [aBal, aUsdc] = await Promise.all([arb.getBalance(tx.from), usdc.balanceOf(tx.from)]);
    if (aBal < 1000000000000000n && aUsdc === 0n) { // ~nothing on Arbitrum
      console.log(`${tx.from}  Base:${formatEther(bBal)} ETH | Arb:${formatEther(aBal)} ETH, ${aUsdc} USDC`);
      found++;
    }
  }
}
if (!found) console.log("none found in scanned blocks");
