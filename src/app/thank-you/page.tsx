import Link from "next/link";
import type { Metadata } from "next";
import type Stripe from "stripe";
import { CheckCircle2, Mail, Calendar, Receipt, CreditCard } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Welcome to The Blueprint | The Franchisor Blueprint",
  description:
    "Your purchase is confirmed. Check your email for instant access and onboarding details.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

type RetrievedSession = Stripe.Response<
  Stripe.Checkout.Session & {
    line_items: Stripe.ApiList<Stripe.LineItem>;
    payment_intent: Stripe.PaymentIntent & { latest_charge: Stripe.Charge };
  }
>;

async function loadOrder(sessionId: string | undefined) {
  if (!sessionId?.startsWith("cs_")) return null;
  try {
    const session = (await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent.latest_charge"],
    })) as RetrievedSession;
    if (session.payment_status !== "paid") return null;
    const line = session.line_items?.data[0];
    const charge = session.payment_intent?.latest_charge;
    return {
      id: session.id,
      productName: line?.description ?? "The Blueprint",
      amount: ((session.amount_total ?? 0) / 100).toLocaleString("en-US", {
        style: "currency",
        currency: (session.currency ?? "usd").toUpperCase(),
      }),
      email: session.customer_details?.email ?? null,
      name: session.customer_details?.name ?? null,
      cardLast4: charge?.payment_method_details?.card?.last4 ?? null,
      cardBrand: charge?.payment_method_details?.card?.brand ?? null,
      created: new Date((session.created ?? 0) * 1000).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    };
  } catch {
    return null;
  }
}

export default async function ThankYouPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  const order = await loadOrder(session_id);

  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="You're In"
        title={order?.name ? `Welcome to The Blueprint, ${order.name.split(" ")[0]}` : "Welcome to The Blueprint"}
        subtitle="Your purchase is confirmed. We're already prepping your onboarding."
      />

      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[760px] mx-auto px-8">
          <div className="bg-cream rounded-2xl border border-gold/30 p-8 md:p-10 text-center mb-10">
            <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-navy to-navy-light items-center justify-center text-gold mb-5">
              <CheckCircle2 size={32} strokeWidth={2} />
            </div>
            <h2 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
              Payment Received
            </h2>
            <p className="text-grey-3 text-base md:text-lg leading-relaxed">
              A receipt is on its way to your inbox from Stripe. Your access details and onboarding instructions will follow shortly from our team.
            </p>
          </div>

          {order && (
            <div className="bg-white border border-navy/10 rounded-2xl shadow-[0_8px_24px_rgba(30,58,95,0.06)] p-7 md:p-8 mb-10">
              <div className="flex items-center gap-2 mb-5">
                <Receipt size={18} className="text-gold" />
                <h3 className="text-navy font-bold text-lg">Order Summary</h3>
              </div>
              <dl className="divide-y divide-navy/5 text-sm">
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-grey-3">Product</dt>
                  <dd className="text-navy font-semibold text-right">{order.productName}</dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-grey-3">Amount paid</dt>
                  <dd className="text-navy font-extrabold text-base tabular-nums">{order.amount}</dd>
                </div>
                {order.email && (
                  <div className="flex items-baseline justify-between py-3">
                    <dt className="text-grey-3">Receipt sent to</dt>
                    <dd className="text-navy font-mono text-xs md:text-sm break-all text-right">{order.email}</dd>
                  </div>
                )}
                {order.cardLast4 && (
                  <div className="flex items-baseline justify-between py-3">
                    <dt className="text-grey-3">Payment method</dt>
                    <dd className="text-navy text-right flex items-center gap-2 justify-end">
                      <CreditCard size={14} className="text-grey-4" />
                      <span className="capitalize">{order.cardBrand}</span>
                      <span className="text-grey-4">••••</span>
                      <span className="font-mono">{order.cardLast4}</span>
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-grey-3">Order ID</dt>
                  <dd className="text-grey-4 font-mono text-[11px] md:text-xs break-all text-right">{order.id}</dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-grey-3">Date</dt>
                  <dd className="text-navy text-right">{order.created}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="space-y-5">
            <div className="bg-white border border-navy/10 rounded-2xl p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Mail size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-lg mb-1">Welcome email on the way</h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  In the next few minutes you&apos;ll receive a confirmation with your next steps. If you don&apos;t see it, check your spam folder or email{" "}
                  <a href="mailto:team@thefranchisorblueprint.com" className="text-navy font-semibold underline">team@thefranchisorblueprint.com</a>.
                </p>
              </div>
            </div>

            <div className="bg-white border border-navy/10 rounded-2xl p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-lg mb-1">
                  Your 60-minute white-glove onboarding call
                </h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  Our team will reach out personally within one business day to schedule your kickoff call with Jason. You&apos;ll leave that call with a clear plan for your first 30 days.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-block bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy hover:text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
