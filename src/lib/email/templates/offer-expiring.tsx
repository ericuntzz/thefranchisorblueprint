import { Heading, Section, Text, Button } from "@react-email/components";
import {
  EmailLayout,
  buttonStyle,
  buttonContainerStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
} from "./_layout";

export type OfferExpiringPayload = {
  firstName: string | null;
  hoursRemaining: number;
  promoPriceFormatted: string;
  basePriceFormatted: string;
  upgradeUrl: string;
  targetTierName: string;
};

export function offerExpiringSubject(p: OfferExpiringPayload): string {
  return `${p.hoursRemaining}h left on your ${p.targetTierName} upgrade discount`;
}

export function OfferExpiringEmail({
  firstName,
  hoursRemaining,
  promoPriceFormatted,
  basePriceFormatted,
  upgradeUrl,
  targetTierName,
}: OfferExpiringPayload) {
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>{hoursRemaining} hours remaining</Text>
      <Heading as="h1" style={headingStyle}>
        {firstName ? `${firstName}, your 10% upgrade discount is ending soon` : "Your 10% upgrade discount is ending soon"}
      </Heading>

      <Text style={paragraphStyle}>
        Quick heads-up: your <strong>10% off</strong> upgrade promo to{" "}
        {targetTierName} expires in about <strong>{hoursRemaining} hours</strong>.
      </Text>

      <Text
        style={{
          ...paragraphStyle,
          fontSize: "28px",
          fontWeight: 800,
          color: "#1E3A5F",
          textAlign: "center",
          margin: "20px 0",
        }}
      >
        {promoPriceFormatted}
        <span style={{ fontSize: "14px", color: "#888B92", fontWeight: 400, marginLeft: "8px", textDecoration: "line-through" }}>
          {basePriceFormatted}
        </span>
      </Text>

      <Section style={buttonContainerStyle}>
        <Button href={upgradeUrl} style={buttonStyle}>
          Lock in your upgrade
        </Button>
      </Section>

      <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92", textAlign: "center", marginTop: "16px" }}>
        After the timer hits zero, you can still upgrade at the credit-forward
        base price ({basePriceFormatted}) — only the extra 10% goes away.
      </Text>
    </EmailLayout>
  );
}

export function offerExpiringText(p: OfferExpiringPayload): string {
  return [
    `${p.firstName ?? "Hi"}, your 10% upgrade discount is ending soon.`,
    ``,
    `Your 10% off upgrade promo to ${p.targetTierName} expires in about ${p.hoursRemaining} hours.`,
    ``,
    `${p.promoPriceFormatted} (was ${p.basePriceFormatted})`,
    ``,
    `Lock in your upgrade: ${p.upgradeUrl}`,
    ``,
    `After the timer hits zero, you can still upgrade at the credit-forward base price (${p.basePriceFormatted}) — only the extra 10% goes away.`,
    ``,
    `— The Franchisor Blueprint team`,
  ].join("\n");
}
