import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Franchise Disclaimer | The Franchisor Blueprint",
  description:
    "Important disclosures about our role as franchise consultants and the legal services that fall outside our scope.",
};

export default function FranchiseDisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Franchise Disclaimer"
      effectiveDate="January 1, 2026"
    >
      <p>
        The Franchisor Blueprint (&ldquo;TFB&rdquo;) is a business consulting firm specializing in franchise development. This page clarifies what we do, what we don&apos;t do, and the role of qualified legal counsel in your franchise journey.
      </p>

      <h2>We Are Consultants, Not Attorneys</h2>
      <p>
        TFB and its principals are <strong>not licensed attorneys</strong>. We do not provide legal advice. The materials we provide — including the Operations Manual templates, FDD Explainer, training programs, and other documents — are educational and informational in nature. They are designed to help you and your franchise attorney work efficiently together, not to substitute for professional legal counsel.
      </p>

      <h2>The Role of a Franchise Attorney</h2>
      <p>
        You are required by federal and state law to engage a qualified franchise attorney to:
      </p>
      <ul>
        <li>Draft and finalize your Franchise Disclosure Document (FDD)</li>
        <li>Register your FDD in any state requiring registration</li>
        <li>Advise you on franchise relationship laws, dispute resolution, and termination provisions</li>
        <li>Counsel you on state-specific franchise regulations and renewal requirements</li>
      </ul>
      <p>
        We can refer you to several qualified franchise attorneys, but the choice and engagement of legal counsel is yours.
      </p>

      <h2>FDD Filing Costs Are Not Included</h2>
      <p>
        Our pricing covers consulting and educational materials. <strong>It does not include</strong> the legal fees charged by your franchise attorney to draft, finalize, file, or register your FDD. These fees typically range from $5,000 to $15,000 or more, depending on your attorney and the number of states in which you intend to register.
      </p>

      <h2>Tax & Accounting</h2>
      <p>
        We are not certified public accountants. While our materials include investment overview templates and pro forma examples, you should consult with a qualified CPA or financial advisor regarding the specific tax, accounting, and financial implications of franchising your business.
      </p>

      <h2>State & Federal Compliance</h2>
      <p>
        Franchising is regulated at both the federal level (by the FTC) and at the state level in registration states (such as California, New York, Illinois, and others). Compliance with these regulations is your responsibility, in coordination with your franchise attorney. We do not offer regulatory or compliance advice.
      </p>

      <h2>Forward-Looking Statements</h2>
      <p>
        Any timelines, milestones, or projections we provide are based on industry experience and reasonable assumptions. Actual timelines depend on your responsiveness, your attorney&apos;s availability, state registration backlogs, and many other factors.
      </p>

      <p>
        By engaging our services, you acknowledge that you understand the role of TFB as a consulting firm and the necessity of independent legal and financial counsel for your franchise journey.
      </p>
    </LegalPage>
  );
}
