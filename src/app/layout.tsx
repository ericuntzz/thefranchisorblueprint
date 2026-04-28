import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/schema";

const inter = Inter({
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://thefranchisorblueprint.com";

export const metadata: Metadata = {
  title: "Franchise Your Business | The Franchisor Blueprint | Affordable Franchise Consulting",
  description:
    "Stop overpaying for franchise development. Get the complete franchisor operating system plus 6 months of 1:1 coaching for a fraction of the cost. Take the free Franchise Readiness Assessment.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  applicationName: "The Franchisor Blueprint",
  authors: [{ name: "Jason Stowe", url: "https://www.linkedin.com/in/jason-stowe-a8093539" }],
  creator: "The Franchisor Blueprint",
  publisher: "The Franchisor Blueprint",
  keywords: [
    "franchise consulting",
    "franchise consulting services",
    "how to franchise my business",
    "franchise development",
    "franchise development consultant",
    "FDD",
    "franchise disclosure document",
    "operations manual",
    "franchise operations manual",
    "Jason Stowe",
    "The Franchisor Blueprint",
  ],
  category: "Business consulting",
  openGraph: {
    title: "The Franchisor Blueprint — Franchise Your Business for a Fraction of the Cost",
    description:
      "The smartest, most affordable path to becoming a franchisor. The complete franchisor operating system + 6 months of 1:1 coaching with founder Jason Stowe.",
    type: "website",
    url: SITE_URL,
    siteName: "The Franchisor Blueprint",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Franchisor Blueprint",
    description:
      "Franchise your business for a fraction of what big firms charge. 9-framework system + 6-month coaching with Jason Stowe.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // GSC + Bing verification — set these in Vercel env vars when GSC/Bing
  // request domain verification via meta tag.
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION }
      : undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID;

  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
      </head>
      <body className="min-h-full flex flex-col bg-white text-[#222]">
        {children}
        <Analytics />

        {/* GA4 — only loads if NEXT_PUBLIC_GA4_ID is set in Vercel */}
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}', { send_page_view: true });`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
