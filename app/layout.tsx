import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal Pro — chain-abstracted subscriptions",
  description:
    "Log in with email, upgrade to a Universal Account via EIP-7702, and pay $5/mo from one unified cross-chain balance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
