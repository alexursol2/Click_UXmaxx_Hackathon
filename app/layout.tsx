import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";

// Quicksand — the closest free, embeddable analog to VAG Rounded (even,
// geometric, rounded terminals). Exposed as the --font-rounded CSS variable.
const rounded = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Click — chain-abstracted subscriptions",
  description:
    "Log in with email, upgrade to a Universal Account via EIP-7702, and pay from one unified cross-chain balance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={rounded.variable}>
      <body>{children}</body>
    </html>
  );
}
