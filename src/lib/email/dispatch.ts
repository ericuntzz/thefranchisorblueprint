import { render } from "@react-email/render";
import {
  WelcomeEmail,
  welcomeSubject,
  welcomeText,
  type WelcomePayload,
} from "./templates/welcome";
import {
  UpgradeNudgeEmail,
  upgradeNudgeSubject,
  upgradeNudgeText,
  type UpgradeNudgePayload,
} from "./templates/upgrade-nudge";
import {
  OfferExpiringEmail,
  offerExpiringSubject,
  offerExpiringText,
  type OfferExpiringPayload,
} from "./templates/offer-expiring";
import {
  WinBackEmail,
  winBackSubject,
  winBackText,
  type WinBackPayload,
} from "./templates/win-back";
import {
  ContactFormConfirmationEmail,
  contactFormConfirmationSubject,
  contactFormConfirmationText,
  type ContactFormConfirmationPayload,
} from "./templates/contact-form-confirmation";
import {
  InternalLeadNotificationEmail,
  internalLeadNotificationSubject,
  internalLeadNotificationText,
  type InternalLeadNotificationPayload,
} from "./templates/internal-lead-notification";
import {
  NewsletterWelcomeEmail,
  newsletterWelcomeSubject,
  newsletterWelcomeText,
  type NewsletterWelcomePayload,
} from "./templates/newsletter-welcome";
import { sendEmail } from "./send";

/**
 * Maps each template name to:
 *  - the React component (rendered to HTML)
 *  - subject builder (computes subject line from payload)
 *  - text builder (plain-text fallback)
 *
 * Adding a new template = (1) write the .tsx + subject + text functions,
 * (2) register it here, (3) it's now sendable from anywhere via
 * sendTemplate("template-name", payload).
 */
type TemplateRegistry = {
  welcome: WelcomePayload;
  "upgrade-nudge": UpgradeNudgePayload;
  "offer-expiring": OfferExpiringPayload;
  "win-back": WinBackPayload;
  "contact-form-confirmation": ContactFormConfirmationPayload;
  "internal-lead-notification": InternalLeadNotificationPayload;
  "newsletter-welcome": NewsletterWelcomePayload;
};

export type TemplateName = keyof TemplateRegistry;

const REGISTRY = {
  welcome: {
    Component: WelcomeEmail,
    subject: welcomeSubject,
    text: welcomeText,
  },
  "upgrade-nudge": {
    Component: UpgradeNudgeEmail,
    subject: upgradeNudgeSubject,
    text: upgradeNudgeText,
  },
  "offer-expiring": {
    Component: OfferExpiringEmail,
    subject: offerExpiringSubject,
    text: offerExpiringText,
  },
  "win-back": {
    Component: WinBackEmail,
    subject: winBackSubject,
    text: winBackText,
  },
  "contact-form-confirmation": {
    Component: ContactFormConfirmationEmail,
    subject: contactFormConfirmationSubject,
    text: contactFormConfirmationText,
  },
  "internal-lead-notification": {
    Component: InternalLeadNotificationEmail,
    subject: internalLeadNotificationSubject,
    text: internalLeadNotificationText,
  },
  "newsletter-welcome": {
    Component: NewsletterWelcomeEmail,
    subject: newsletterWelcomeSubject,
    text: newsletterWelcomeText,
  },
} as const;

/**
 * Render + send an email immediately. Used by both the immediate triggers
 * (welcome on purchase) and the cron drip processor (scheduled emails).
 *
 * Returns the sendEmail result so callers can persist sent_at / failure.
 *
 * Pass `idempotencyKey` (typically the scheduled_emails.id from the queue,
 * or a deterministic key for direct sends) to ensure a retry doesn't
 * actually deliver the email twice — Resend dedupes server-side.
 */
export async function sendTemplate<T extends TemplateName>(
  template: T,
  to: string,
  payload: TemplateRegistry[T],
  options?: { idempotencyKey?: string },
) {
  const def = REGISTRY[template];
  if (!def) {
    return {
      ok: false as const,
      error: `Unknown template "${template}"`,
    };
  }

  // Type-narrow: TS can't see that REGISTRY entries' Component params match
  // their corresponding payload. Cast only at the boundary.
  const Component = def.Component as (
    p: TemplateRegistry[T],
  ) => React.ReactElement;
  const subject = (def.subject as (p: TemplateRegistry[T]) => string)(payload);
  const text = (def.text as (p: TemplateRegistry[T]) => string)(payload);
  const html = await render(Component(payload));

  return sendEmail({
    to,
    subject,
    html,
    text,
    tag: template,
    idempotencyKey: options?.idempotencyKey,
  });
}
