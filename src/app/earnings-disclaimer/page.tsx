import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Earnings Disclaimer | The Franchisor Blueprint",
  description:
    "Important disclosures about income claims, results, and the inherent risks of franchising.",
};

export default function EarningsDisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Earnings Disclaimer"
      effectiveDate="January 1, 2026"
    >
      <p>
        The Franchisor Blueprint provides educational and consulting services to help business owners explore franchise development. Any income figures, ROI calculations, success stories, or testimonials presented on this website or in our materials are for illustrative purposes only and do not constitute a guarantee or representation of the income you can expect from franchising your business.
      </p>

      <h2>No Guarantee of Results</h2>
      <p>
        Franchising is a complex business endeavor that involves substantial risk. The success of any franchise system depends on numerous factors, many of which are outside our control, including but not limited to:
      </p>
      <ul>
        <li>The strength and uniqueness of your underlying business model</li>
        <li>Market demand for your products or services</li>
        <li>Quality of operations, training, and ongoing franchisee support</li>
        <li>Capital available for ongoing brand development</li>
        <li>Economic conditions, regulatory environment, and competitive landscape</li>
        <li>Your individual effort, time commitment, and execution capability</li>
      </ul>

      <h2>Example Calculations</h2>
      <p>
        Example ROI calculations shown on our pricing page (such as the $40,000 first-franchise-fee scenario) are illustrative only and are based on industry-typical franchise fee ranges. Your actual results will vary based on your franchise fee structure, sales activity, royalty rates, marketing costs, and many other factors.
      </p>

      <h2>Testimonials</h2>
      <p>
        Testimonials and case studies on our site reflect the individual experiences of specific clients. They are not typical results and should not be interpreted as guarantees, predictions, or assurances that you will achieve the same outcomes.
      </p>

      <h2>Industry Statistics</h2>
      <p>
        Any statistics referencing franchise industry performance, competitor pricing, or market data are based on publicly available sources and reasonable estimates. We make no representation that such figures are exhaustive or current as of your viewing.
      </p>

      <h2>Your Responsibility</h2>
      <p>
        Before franchising your business, you should consult with qualified professionals — including a franchise attorney, a CPA, and (if applicable) a financial advisor — to evaluate the suitability of franchising for your specific situation.
      </p>

      <p>
        By using our services, you acknowledge that you understand and accept these disclosures.
      </p>
    </LegalPage>
  );
}
