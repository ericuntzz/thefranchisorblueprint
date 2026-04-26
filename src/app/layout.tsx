import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";
import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Franchise Your Business | The Franchisor Blueprint | Affordable Franchise Consulting",
  description:
    "Stop overpaying for franchise development. Get the complete 9-document system plus 6 months of expert coaching for a fraction of the cost. Take the free Franchise Readiness Assessment.",
  metadataBase: new URL("https://thefranchisorblueprint.com"),
  openGraph: {
    title: "The Franchisor Blueprint",
    description:
      "The smartest, most affordable path to becoming a franchisor. 9-document system + 6 months of expert coaching.",
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
      className={`${lato.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#222]">
        {children}
      </body>
    </html>
  );
}
