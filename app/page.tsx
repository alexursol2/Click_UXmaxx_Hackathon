"use client";

import "./onlycrabs.css";
import { UniversalSubscriptionProvider } from "@/components/UniversalSubscriptionProvider";
import { StoreProvider } from "@/components/StoreProvider";
import { Storefront } from "@/components/Storefront";

export default function Home() {
  // One wrap configures the whole library (env defaults here; a host app would
  // pass config={{ merchant, price, chain, ... }}). StoreProvider then shares a
  // single checkout + auth session across the storefront and the Account modal.
  return (
    <UniversalSubscriptionProvider>
      <StoreProvider>
        <Storefront />
      </StoreProvider>
    </UniversalSubscriptionProvider>
  );
}
