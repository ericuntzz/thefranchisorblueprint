import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | The Franchisor Blueprint",
  description: "How we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" effectiveDate="January 1, 2026">
      <p>
        The Franchisor Blueprint (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy. This Privacy Policy explains what information we collect, how we use it, and the choices you have.
      </p>

      <h2>Information We Collect</h2>
      <p>We collect information you voluntarily provide, including:</p>
      <ul>
        <li>Contact details (name, email, phone, business name) submitted via our forms</li>
        <li>Survey and assessment responses (Franchise Readiness Assessment)</li>
        <li>Calendar booking information when you schedule a strategy call</li>
        <li>Payment information processed by our third-party payment processor (we do not store card data)</li>
      </ul>
      <p>We also collect certain information automatically when you visit the site, including IP address, browser type, pages visited, and referral source. This is collected via standard analytics tools.</p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To respond to your inquiries and deliver the services you request</li>
        <li>To send you relevant educational emails (you can unsubscribe at any time)</li>
        <li>To process payments and deliver purchased products</li>
        <li>To improve our website, content, and services</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>How We Share Information</h2>
      <p>We do not sell your personal information. We share data only with:</p>
      <ul>
        <li>Service providers who help us operate the business (e.g., email platform, payment processor, calendar tool) under appropriate data-protection agreements</li>
        <li>Legal authorities when required by law</li>
      </ul>

      <h2>Cookies & Tracking</h2>
      <p>We use cookies and similar technologies to improve your experience and measure site performance. You can disable cookies in your browser settings, though some site features may not work as expected.</p>

      <h2>Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or restrict the use of your personal data. To exercise these rights, contact us at <a href="mailto:info@thefranchisorblueprint.com">info@thefranchisorblueprint.com</a>.</p>

      <h2>Data Security</h2>
      <p>We implement reasonable technical and organizational measures to protect your information. However, no system is 100% secure, and we cannot guarantee absolute security.</p>

      <h2>Children&apos;s Privacy</h2>
      <p>Our services are not directed to individuals under 18 and we do not knowingly collect personal information from children.</p>

      <h2>Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. The updated version will be posted here with a new effective date.</p>

      <h2>Contact</h2>
      <p>Questions about this policy? Email us at <a href="mailto:info@thefranchisorblueprint.com">info@thefranchisorblueprint.com</a>.</p>
    </LegalPage>
  );
}
