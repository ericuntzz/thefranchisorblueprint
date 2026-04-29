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
  navigatorUrl: string;
};

export function winBackSubject(p: WinBackPayload): string {
  return `${p.firstName ?? "Hey"} — quick favor, would you tell us why?`;
}

export function WinBackEmail({
  firstName,
  refundedProductName,
  navigatorUrl,
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
          that&apos;s you, our Navigator tier (24 weekly 1:1 coaching calls
          with Jason + document review) is built for exactly that gap. Many
          refunders re-engage at Navigator and finish in under 6 months.
        </Text>
        <Text style={paragraphStyle}>
          We&apos;d love a chance to get this right. Take a look — no pressure.
        </Text>
      </Section>

      <Section style={buttonContainerStyle}>
        <Button href={navigatorUrl} style={buttonStyle}>
          Learn about Navigator
        </Button>
      </Section>

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
    `We do want to ask one favor though — what didn't work? Was the DIY pace overwhelming? Were the docs missing something? Were you not actually ready to franchise yet? Just hit reply and tell us in one sentence. It's the only way we get better.`,
    ``,
    `ONE THING IF YOU'RE OPEN TO IT:`,
    ``,
    `The most common reason customers refund ${p.refundedProductName} is that doing it alone is harder than it looks. If that's you, our Navigator tier (24 weekly 1:1 coaching calls with Jason + document review) is built for exactly that gap. Many refunders re-engage at Navigator and finish in under 6 months.`,
    ``,
    `We'd love a chance to get this right. Take a look — no pressure.`,
    ``,
    `Learn about Navigator: ${p.navigatorUrl}`,
    ``,
    `Thanks for trying us out either way.`,
    ``,
    `— Jason & the team`,
  ].join("\n");
}
