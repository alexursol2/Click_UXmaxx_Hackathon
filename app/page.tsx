"use client";

import "./onlycrabs.css";
import { ClickProvider } from "@/components/ClickProvider";
import { Storefront } from "@/components/Storefront";

export default function Home() {
  // The whole Click account — config, session (auth + unified balance +
  // checkout + login gate), the Account modal and the payment status card — is
  // set up by this single wrap. Any other site integrates the same way; see
  // README "Add Click to any site". The demo passes no config (env defaults).
  return (
    <ClickProvider>
      <Storefront />
    </ClickProvider>
  );
}
