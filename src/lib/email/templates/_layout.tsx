import {
  Body,
  Container,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Shared TFB-branded email shell.
 *
 * Inline styles only — many email clients strip <style> blocks. Layout
 * uses table-based React Email components which render to email-client-
 * compatible HTML automatically.
 *
 * Brand palette tokens kept in sync with the website:
 *   navy:       #1E3A5F
 *   gold:       #D4A24C
 *   gold-warm:  #BC8A36
 *   cream:      #ECE9DF
 *   grey-3:     #4F5562 (body text)
 *   grey-4:     #888B92 (muted)
 */
export function EmailLayout({ children }: { children: ReactNode }) {
  return (
    <Html>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerSectionStyle}>
            <Img
              src="https://www.thefranchisorblueprint.com/logos/tfb-logo-color.png"
              alt="The Franchisor Blueprint"
              width="180"
              height="auto"
              style={{ display: "block", margin: "0 auto" }}
            />
          </Section>

          {/* Body */}
          <Section style={contentSectionStyle}>{children}</Section>

          {/* Footer */}
          <Hr style={hrStyle} />
          <Section style={footerSectionStyle}>
            <Text style={footerTextStyle}>
              The Franchisor Blueprint · The Smartest, Most Affordable Path to Becoming a Franchisor
            </Text>
            <Text style={footerLinksStyle}>
              <Link href="https://www.thefranchisorblueprint.com" style={footerLinkStyle}>
                thefranchisorblueprint.com
              </Link>
              {"  ·  "}
              <Link
                href="mailto:team@thefranchisorblueprint.com"
                style={footerLinkStyle}
              >
                team@thefranchisorblueprint.com
              </Link>
            </Text>
            <Text style={footerLegalStyle}>
              The Franchisor Blueprint is a consulting firm, not a law firm. All
              legal work is performed by qualified franchise counsel.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#F5F2E8",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  margin: "0 auto",
  padding: "32px 0",
  maxWidth: "600px",
  width: "100%",
};

const headerSectionStyle: React.CSSProperties = {
  padding: "0 24px 24px",
  textAlign: "center",
};

const contentSectionStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: "16px",
  padding: "40px 32px",
  boxShadow: "0 4px 14px rgba(30, 58, 95, 0.06)",
};

const hrStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid rgba(30, 58, 95, 0.08)",
  margin: "32px 24px 16px",
};

const footerSectionStyle: React.CSSProperties = {
  padding: "0 24px 16px",
  textAlign: "center",
};

const footerTextStyle: React.CSSProperties = {
  color: "#4F5562",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const footerLinksStyle: React.CSSProperties = {
  color: "#888B92",
  fontSize: "12px",
  margin: "0 0 12px",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#1E3A5F",
  textDecoration: "underline",
};

const footerLegalStyle: React.CSSProperties = {
  color: "#888B92",
  fontSize: "11px",
  lineHeight: "1.6",
  margin: "0",
  fontStyle: "italic",
};

// ─── Reusable atoms for use inside templates ───
export const headingStyle: React.CSSProperties = {
  color: "#1E3A5F",
  fontSize: "26px",
  fontWeight: 800,
  lineHeight: "1.25",
  margin: "0 0 16px",
};

export const subheadingStyle: React.CSSProperties = {
  color: "#1E3A5F",
  fontSize: "18px",
  fontWeight: 700,
  margin: "24px 0 8px",
};

export const paragraphStyle: React.CSSProperties = {
  color: "#4F5562",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 16px",
};

export const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#D4A24C",
  color: "#1E3A5F",
  fontWeight: 700,
  textDecoration: "none",
  padding: "14px 32px",
  borderRadius: "999px",
  fontSize: "14px",
  letterSpacing: "0.6px",
  textTransform: "uppercase" as const,
};

export const buttonContainerStyle: React.CSSProperties = {
  margin: "28px 0 16px",
  textAlign: "center",
};

export const eyebrowStyle: React.CSSProperties = {
  color: "#BC8A36",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
};

export const callOutStyle: React.CSSProperties = {
  backgroundColor: "#ECE9DF",
  borderRadius: "12px",
  padding: "20px 24px",
  margin: "24px 0",
};

export const linkStyle: React.CSSProperties = {
  color: "#1E3A5F",
  fontWeight: 600,
};
