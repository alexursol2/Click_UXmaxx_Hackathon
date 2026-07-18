"use client";

import { useState } from "react";

const TW = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

const ICONS: Record<string, string> = {
  ETH: `${TW}/ethereum/info/logo.png`,
  USDC: `${TW}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`,
  USDT: `${TW}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`,
  BNB: `${TW}/binance/info/logo.png`,
  SOL: `${TW}/solana/info/logo.png`,
  BTC: `${TW}/bitcoin/info/logo.png`,
};

/** Coin logo (CDN) with a coloured letter-badge fallback if it fails to load. */
export function TokenIcon({
  symbol,
  className = "h-8 w-8",
}: {
  symbol: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = ICONS[symbol];

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={symbol}
        onError={() => setFailed(true)}
        className={`${className} rounded-full`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center rounded-full bg-[#9b03f2]/15 text-xs font-bold text-[color:var(--text)]`}
    >
      {symbol.slice(0, 3)}
    </div>
  );
}
