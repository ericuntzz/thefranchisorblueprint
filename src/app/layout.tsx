import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";
import { AssessmentResumeBanner } from "@/components/AssessmentResumeBanner";

const inter = Inter({
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Franchise Your Business | The Franchisor Blueprint",
  description:
    "Stop overpaying for franchise development. Get the complete franchisor operating system plus 6 months of 1:1 coaching for a fraction of the cost. Take the free Franchise Readiness Assessment.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "The Franchisor Blueprint Blog" },
      ],
    },
  },
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
  // Theme-aware favicons. The TFB mark is two-tone (royal blue + dark navy),
  // which reads well on light tab strips but the navy half loses contrast on
  // dark tab strips. The light variant uses the original mark; the dark
  // variant has the navy strokes recolored to cream so the mark stays
  // legible against dark browser chrome.
  // - favicon.ico (multi-size 16/32/48/64) is auto-discovered from app/
  //   and serves as the legacy fallback at /favicon.ico.
  // - apple-icon.png is auto-discovered from app/ for iOS home-screen.
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-192.png", sizes: "192x192", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
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
        {/* Preconnect to Calendly hosts so the TCP+TLS handshake happens
            during HTML parse, not after the embed script's useEffect fires
            on /strategy-call/* pages. ~100-300ms saved on first Calendly
            paint. Cheap on pages that don't use Calendly — the browser
            drops idle preconnect sockets after a short window. */}
        <link rel="preconnect" href="https://assets.calendly.com" crossOrigin="" />
        <link rel="preconnect" href="https://calendly.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://assets.calendly.com" />
        <link rel="dns-prefetch" href="https://calendly.com" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-[#222]">
        {children}
        {/* Floats above the page when an in-progress assessment cookie is
            present (and the user isn't already on /assessment or /portal).
            Self-hides otherwise — zero cost on most pageviews. */}
        <AssessmentResumeBanner />
        <Analytics />
        <SpeedInsights />

        {/* GA4 — only loads if NEXT_PUBLIC_GA4_ID is set in Vercel.
            We hard-skip initialization for automated browsers
            (Playwright, Puppeteer, Selenium, Cypress, etc.) so the daily
            smoke-test routine + ad-hoc QA scripts don't pollute production
            analytics. `navigator.webdriver === true` is the W3C-standard
            signal every major automation framework sets. Real visitors
            never have this set. */}
        {ga4Id && (
          <>
            <Script id="ga4-bot-guard" strategy="beforeInteractive">
              {`window.__tfb_skip_ga = (typeof navigator !== 'undefined' && navigator.webdriver === true);`}
            </Script>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
if (window.__tfb_skip_ga) {
  // Stub gtag so track() calls in app code stay no-ops without throwing.
  window.gtag = function(){};
} else {
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', '${ga4Id}', { send_page_view: true });
}`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
