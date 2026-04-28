/**
 * Outbound notifications: transactional email (Resend) and SMS (Twilio).
 *
 * Every function is defensive — if the relevant env vars aren't set, we log
 * and return rather than throw. This way the Stripe webhook handler can call
 * these unconditionally without risking a 500 (which would tell Stripe to
 * retry). Money has already changed hands by the time we run; missing a
 * notification is recoverable, but losing an event isn't.
 */

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, text, html, replyTo }: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "The Franchisor Blueprint <onboarding@resend.dev>";
  if (!apiKey) {
    console.log(`[notifications] skipping email to ${to} — RESEND_API_KEY not set`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[notifications] resend ${res.status}: ${body.slice(0, 300)}`);
      return;
    }
    console.log(`[notifications] email sent to ${to} subject="${subject}"`);
  } catch (err) {
    console.error(`[notifications] email error: ${err instanceof Error ? err.message : err}`);
  }
}

export async function sendSMS(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;
  if (!sid || !token || !from) {
    console.log(`[notifications] skipping SMS to ${to} — Twilio env not set`);
    return;
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[notifications] twilio ${res.status}: ${text.slice(0, 300)}`);
      return;
    }
    console.log(`[notifications] SMS sent to ${to}`);
  } catch (err) {
    console.error(`[notifications] SMS error: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Internal team alert when a sale lands. Sends both email and SMS in parallel
 * so a Twilio outage doesn't delay the email. Recipients come from env vars.
 */
export async function notifyTeamOfSale(args: {
  product: string;
  amount: string;
  customerEmail: string;
  customerName: string;
  sessionId: string;
  paymentIntentId: string;
}): Promise<void> {
  const teamEmail = process.env.NOTIFY_EMAIL;
  const teamPhone = process.env.NOTIFY_PHONE;
  const dashboardUrl = `https://dashboard.stripe.com/test/payments/${args.paymentIntentId}`;

  const subject = `🎉 New TFB sale: ${args.product} — ${args.amount}`;
  const text = [
    `New purchase!`,
    ``,
    `Product:  ${args.product}`,
    `Amount:   ${args.amount}`,
    `Customer: ${args.customerName || "(no name)"} <${args.customerEmail}>`,
    `Session:  ${args.sessionId}`,
    ``,
    `View in Stripe: ${dashboardUrl}`,
    ``,
    `Next step: reach out within one business day to schedule the 60-min onboarding call.`,
  ].join("\n");

  const sms = `New TFB sale: ${args.product} ${args.amount} — ${args.customerName || args.customerEmail}. Reach out today.`;

  const tasks: Promise<void>[] = [];
  if (teamEmail) tasks.push(sendEmail({ to: teamEmail, subject, text }));
  if (teamPhone) tasks.push(sendSMS(teamPhone, sms));
  await Promise.allSettled(tasks);
}

/**
 * Customer welcome email after successful checkout. Plain-language confirmation
 * with the receipt summary and what to expect next.
 */
export async function sendCustomerWelcome(args: {
  to: string;
  name: string | null;
  product: string;
  amount: string;
  sessionId: string;
}): Promise<void> {
  if (!args.to) return;
  const greeting = args.name ? `Hi ${args.name.split(" ")[0]},` : "Hi there,";
  const subject = `Welcome to The Blueprint — your access details`;
  const text = [
    greeting,
    ``,
    `Thank you for purchasing ${args.product}. Your payment of ${args.amount} has been received and your Stripe receipt is on its way.`,
    ``,
    `What happens next:`,
    ``,
    `1. Within one business day, our team will reach out personally to schedule your 60-minute white-glove onboarding call with Jason. On that call we'll walk through the operating system, answer your questions, and map out your first 30 days.`,
    ``,
    `2. You'll get full access to all nine capabilities in the franchisor operating system — the audit, the roadmap, the unit-economics templates, the operations manual, the FDD breakdown, the candidate scoring matrix, the discovery day deck, and everything else.`,
    ``,
    `3. You have 30 days of email support included. Just reply to this email any time.`,
    ``,
    `If you have any immediate questions, reply to this email or reach us at team@thefranchisorblueprint.com.`,
    ``,
    `Looking forward to building this with you.`,
    ``,
    `— The Franchisor Blueprint Team`,
    ``,
    `---`,
    `Order ID: ${args.sessionId}`,
  ].join("\n");

  await sendEmail({
    to: args.to,
    subject,
    text,
    replyTo: process.env.NOTIFY_EMAIL,
  });
}
