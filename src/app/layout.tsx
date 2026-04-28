import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Franchise Your Business | The Franchisor Blueprint | Affordable Franchise Consulting",
  description:
    "Stop overpaying for franchise development. Get the complete franchisor operating system plus 6 months of 1:1 coaching for a fraction of the cost. Take the free Franchise Readiness Assessment.",
  metadataBase: new URL("https://thefranchisorblueprint.com"),
  openGraph: {
    title: "The Franchisor Blueprint",
    description:
      "The smartest, most affordable path to becoming a franchisor. The complete franchisor operating system + 6 months of 1:1 coaching.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#222]">
        {children}
      </body>
    </html>
  );
}
