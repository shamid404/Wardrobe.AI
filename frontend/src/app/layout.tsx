import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = DM_Sans({ subsets: ["latin"], variable: "--font-inter", display: "swap", weight: ["300", "400", "500", "600"] });
const playfair = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["300", "400", "500", "600", "700"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Wardrobe.ai — Your closet, reimagined",
  description: "Virtual Try-On Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
