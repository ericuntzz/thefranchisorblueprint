import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | The Franchisor Blueprint",
  description: "Terms governing your use of The Franchisor Blueprint website and services.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Service" effectiveDate="January 1, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the website at thefranchisorblueprint.com and any services provided by The Franchisor Blueprint (&ldquo;TFB,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;). By using our site or purchasing our services, you agree to these Terms.
      </p>

      <h2>1. Services Provided</h2>
      <p>TFB provides business consulting and educational services related to franchise development. We are not a law firm. We do not provide legal advice. Any legal documents prepared as part of our services (such as Operations Manual templates and FDD explainers) are educational and informational in nature and must be reviewed and finalized by a qualified franchise attorney before use.</p>

      <h2>2. Purchases & Payment</h2>
      <p>All purchases are processed through our third-party payment processor. Pricing is displayed in U.S. dollars. By submitting payment, you authorize us to charge your selected payment method for the agreed amount.</p>

      <h2>3. Refund Policy</h2>
      <ul>
        <li>
          <strong>The Blueprint (Tier 1, $2,997):</strong> 30-day satisfaction guarantee. If you are not satisfied within 30 days of purchase, email us at info@thefranchisorblueprint.com for a full refund.
        </li>
        <li>
          <strong>Navigator (Tier 2) and Builder (Tier 3):</strong> Refund policies are governed by the consulting engagement agreement signed at the start of your program. In general, deposits are refundable within 7 days of payment if no work has begun; thereafter, refunds are pro-rated based on work completed.
        </li>
      </ul>

      <h2>4. Intellectual Property</h2>
      <p>All content, documents, templates, and materials provided through our services are the intellectual property of TFB. You receive a non-exclusive, non-transferable license to use them in your own franchise development. You may not resell, redistribute, or republish our materials.</p>

      <h2>5. Your Responsibilities</h2>
      <p>You agree to provide accurate information, to use our services lawfully, and to consult appropriate legal, accounting, and tax professionals before making business decisions based on our materials.</p>

      <h2>6. Disclaimers</h2>
      <p>Our services are provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee specific business outcomes or financial results. Franchising involves substantial risk, and individual results vary based on factors outside our control.</p>

      <h2>7. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, TFB&apos;s total liability for any claim arising from these Terms or your use of our services shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

      <h2>8. Governing Law</h2>
      <p>These Terms are governed by the laws of the State of Utah, without regard to conflict-of-laws principles. Any disputes shall be resolved in the courts located in Utah.</p>

      <h2>9. Changes to These Terms</h2>
      <p>We may update these Terms from time to time. Continued use of our site or services after changes constitutes acceptance of the updated Terms.</p>

      <h2>10. Contact</h2>
      <p>Questions? Email us at <a href="mailto:info@thefranchisorblueprint.com">info@thefranchisorblueprint.com</a>.</p>
    </LegalPage>
  );
}
