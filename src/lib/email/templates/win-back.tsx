import { Heading, Section, Text, Button } from "@react-email/components";
import {
  EmailLayout,
  buttonStyle,
  buttonContainerStyle,
  callOutStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
} from "./_layout";

export type WinBackPayload = {
  firstName: string | null;
  refundedProductName: string;
  /** URL where the customer can buy Blueprint Plus (with WINBACK1K applied at checkout). */
  blueprintPlusUrl: string;
  /** Promo code customers paste into Stripe Checkout to get $1,000 off Plus. */
  promoCode: string;
};

export function winBackSubject(p: WinBackPayload): string {
  return `${p.firstName ?? "Hey"} — quick favor, would you tell us why?`;
}

export function WinBackEmail({
  firstName,
  refundedProductName,
  blueprintPlusUrl,
  promoCode,
}: WinBackPayload) {
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>We&apos;d love your honest take</Text>
      <Heading as="h1" style={headingStyle}>
        {firstName ? `${firstName}, sorry to see you go` : "Sorry to see you go"}
      </Heading>

      <Text style={paragraphStyle}>
        We refunded your {refundedProductName} purchase, no questions asked.
        That&apos;s the deal we promised.
      </Text>

      <Text style={paragraphStyle}>
        We do want to ask one favor though — what didn&apos;t work? Was the
        DIY pace overwhelming? Were the docs missing something? Were you not
        actually ready to franchise yet? Just hit reply and tell us in one
        sentence. It&apos;s the only way we get better.
      </Text>

      <Section style={callOutStyle}>
        <Heading as="h2" style={{ ...headingStyle, fontSize: "18px", margin: "0 0 8px" }}>
          One thing if you&apos;re open to it:
        </Heading>
        <Text style={paragraphStyle}>
          The most common reason customers refund {refundedProductName} is
          that <strong>doing it alone is harder than it looks</strong>. If
          that&apos;s you, our <strong>Blueprint Plus</strong> tier adds 4
          one-on-one coaching calls with Jason on top of the same docs
          you already had — usually enough to unstick the hard sections
          (the Operations Manual and FDD breakdown).
        </Text>
        <Text style={paragraphStyle}>
          As a thank-you for trying us out, we&apos;ll knock <strong>$1,000 off</strong>{" "}
          Blueprint Plus if you want to give it a real go: <strong>$3,997</strong>{" "}
          instead of $4,997. Use code <strong>{promoCode}</strong> at checkout.
        </Text>
      </Section>

      <Section style={buttonContainerStyle}>
        <Button href={blueprintPlusUrl} style={buttonStyle}>
          Try Blueprint Plus — $3,997
        </Button>
      </Section>

      <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92", textAlign: "center" }}>
        Same 30-day money-back guarantee on Plus. If coaching isn&apos;t the
        missing piece for you either, full refund — no questions, no friction.
      </Text>

      <Text style={paragraphStyle}>Thanks for trying us out either way.</Text>
      <Text style={paragraphStyle}>— Jason &amp; the team</Text>
    </EmailLayout>
  );
}

export function winBackText(p: WinBackPayload): string {
  return [
    `${p.firstName ?? "Hey"}, sorry to see you go.`,
    ``,
    `We refunded your ${p.refundedProductName} purchase, no questions asked. That's the deal we promised.`,
    ``,
    `We do want to ask one favor: what didn't work? Was the DIY pace overwhelming? Were the docs missing something? Were you not actually ready to franchise yet? Just hit reply and tell us in one sentence — it's the only way we get better.`,
    ``,
    `ONE THING IF YOU'RE OPEN TO IT:`,
    ``,
    `The most common reason customers refund ${p.refundedProductName} is that doing it alone is harder than it looks. If that's you, our Blueprint Plus tier adds 4 one-on-one coaching calls with Jason on top of the same docs — usually enough to unstick the hard sections (the Operations Manual and FDD breakdown).`,
    ``,
    `As a thank-you for trying us out, we'll knock $1,000 off Blueprint Plus: $3,997 instead of $4,997. Use code ${p.promoCode} at checkout.`,
    ``,
    `Try Blueprint Plus — $3,997: ${p.blueprintPlusUrl}`,
    ``,
    `Same 30-day money-back guarantee on Plus. If coaching isn't the missing piece for you either, full refund — no questions, no friction.`,
    ``,
    `Thanks for trying us out either way.`,
    ``,
    `— Jason & the team`,
  ].join("\n");
}
