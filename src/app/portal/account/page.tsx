import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getProduct } from "@/lib/products";
import type {
  CoachingSession,
  Profile,
  Purchase,
  Tier,
} from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Your Account | The Franchisor Blueprint Portal",
  description: "Profile, purchase history, coaching sessions, and billing.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ok?: string; err?: string }>;
}

const TIER_LABELS: Record<Tier, string> = {
  1: "The Blueprint",
  2: "Navigator",
  3: "Builder",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCents(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

export default async function AccountPage({ searchParams }: PageProps) {
  const { ok: successFlag, err: errorFlag } = await searchParams;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/account");

  const [
    { data: profileData },
    { data: purchasesData },
    { data: sessionsData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("coaching_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileData as Profile | null;
  const purchases = (purchasesData ?? []) as Purchase[];
  const sessions = (sessionsData ?? []) as CoachingSession[];

  const paidPurchases = purchases.filter((p) => p.status === "paid");
  if (paidPurchases.length === 0) redirect("/portal");

  const tier = (Math.max(...paidPurchases.map((p) => p.tier)) as Tier);
  const credits = profile?.coaching_credits ?? 0;
  const memberSince = profile?.created_at ? formatDate(profile.created_at) : "—";
  const daysSinceJoined = profile?.created_at
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(profile.created_at).getTime()) /
            (24 * 3600 * 1000),
        ) + 1,
      )
    : null;
  const hasStripeCustomer = !!profile?.stripe_customer_id;

  const upcomingSessions = sessions.filter(
    (s) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date(),
  );
  const pastSessions = sessions.filter(
    (s) => s.status !== "scheduled" || new Date(s.scheduled_at) <= new Date(),
  );

  return (
    <>
      {/* ===== Hero ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <div>
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Account
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy">
            {profile?.full_name?.trim() || "Your Account"}
          </h1>
          <p className="text-grey-3 text-base md:text-lg mt-2">
            Member since {memberSince}
            {daysSinceJoined !== null && <> · Day {daysSinceJoined} of your journey</>}
          </p>
        </div>
      </section>

      {/* Toast / flash messages */}
      {(successFlag || errorFlag) && (
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 mt-6">
          {successFlag === "name_updated" && (
            <FlashBanner kind="success" message="Your name has been updated." />
          )}
          {errorFlag === "no_billing" && (
            <FlashBanner
              kind="warn"
              message="No billing data on file yet — purchase data appears here after your first paid checkout."
            />
          )}
          {errorFlag === "portal_failed" && (
            <FlashBanner
              kind="error"
              message="Couldn't open the billing portal. Please try again or email team@thefranchisorblueprint.com."
            />
          )}
          {errorFlag === "name_too_long" && (
            <FlashBanner kind="error" message="Names must be under 100 characters." />
          )}
          {errorFlag === "update_failed" && (
            <FlashBanner
              kind="error"
              message="Couldn't save that change. Please try again."
            />
          )}
        </div>
      )}

      <section className="py-10 md:py-14">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 space-y-8">
          {/* ===== Profile ===== */}
          <Card title="Profile" icon={User}>
            <form
              action="/api/portal/profile"
              method="POST"
              className="grid sm:grid-cols-[1fr_auto] gap-4 items-end"
            >
              <div>
                <label
                  htmlFor="full_name"
                  className="block text-navy text-sm font-semibold mb-2"
                >
                  Full name
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  defaultValue={profile?.full_name ?? ""}
                  maxLength={100}
                  className="w-full border border-navy/15 rounded-xl px-4 py-2.5 text-base text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  placeholder="Your name"
                />
              </div>
              <button
                type="submit"
                className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-2.5 rounded-full hover:bg-gold-dark transition-colors cursor-pointer h-fit"
              >
                Save
              </button>
            </form>
            <div className="mt-5 pt-5 border-t border-navy/5 grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Email">
                <span className="font-mono text-navy break-all">{user.email}</span>
                <span className="block text-xs text-grey-3 mt-1 italic">
                  To change your email, email{" "}
                  <a
                    href="mailto:team@thefranchisorblueprint.com"
                    className="text-navy underline"
                  >
                    team@thefranchisorblueprint.com
                  </a>
                </span>
              </Field>
              <Field label="Access tier">
                <span className="text-navy font-semibold">{TIER_LABELS[tier]}</span>
              </Field>
            </div>
          </Card>

          {/* ===== Purchase history ===== */}
          <Card title="Purchase History" icon={CreditCard}>
            {purchases.length === 0 ? (
              <p className="text-grey-3 text-sm">No purchases on file yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold tracking-[0.16em] uppercase text-grey-3 border-b border-navy/10">
                      <th className="py-3 px-2">Date</th>
                      <th className="py-3 px-2">Product</th>
                      <th className="py-3 px-2 text-right">Amount</th>
                      <th className="py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/5">
                    {purchases.map((p) => {
                      const product = getProduct(p.product);
                      return (
                        <tr key={p.id}>
                          <td className="py-3 px-2 text-grey-3">
                            {formatDate(p.created_at)}
                          </td>
                          <td className="py-3 px-2 text-navy font-semibold">
                            {product?.name ?? p.product}
                          </td>
                          <td className="py-3 px-2 text-navy font-bold tabular-nums text-right">
                            {formatCents(p.amount_cents, p.currency)}
                          </td>
                          <td className="py-3 px-2">
                            {p.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.12em] uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                <CheckCircle2 size={11} />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.12em] uppercase text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                <XCircle size={11} />
                                Refunded
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {hasStripeCustomer && (
              <div className="mt-5 pt-5 border-t border-navy/5">
                <form action="/api/portal/billing-portal" method="POST">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 text-navy font-semibold text-sm hover:text-gold-warm transition-colors cursor-pointer"
                  >
                    <ExternalLink size={14} className="text-grey-3" />
                    Open Stripe billing portal — invoices &amp; payment methods
                  </button>
                </form>
              </div>
            )}
          </Card>

          {/* ===== Coaching ===== */}
          <Card title="Coaching" icon={Sparkles}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                  Available credits
                </div>
                <div className="text-navy font-extrabold text-3xl tabular-nums">
                  {credits}
                </div>
              </div>
              {credits > 0 ? (
                <Link
                  href="/portal/coaching/schedule"
                  className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark transition-colors"
                >
                  Schedule a call <ArrowRight size={14} />
                </Link>
              ) : (
                <Link
                  href="/portal/coaching"
                  className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-navy hover:text-white transition-colors"
                >
                  Add coaching <ArrowRight size={14} />
                </Link>
              )}
            </div>

            {upcomingSessions.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-2">
                  Upcoming sessions
                </div>
                <ul className="space-y-2">
                  {upcomingSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 bg-cream rounded-xl p-3 text-sm"
                    >
                      <Calendar size={15} className="text-gold-warm" />
                      <span className="text-navy font-semibold">
                        {formatDateTime(s.scheduled_at)}
                      </span>
                      <span className="text-grey-3 text-xs">· coaching</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pastSessions.length > 0 && (
              <div>
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-grey-3 mb-2">
                  Past sessions
                </div>
                <ul className="space-y-2">
                  {pastSessions.slice(0, 8).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2.5 text-grey-3 text-sm"
                    >
                      <span
                        className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-grey-4/60"
                        aria-hidden
                      />
                      <span>{formatDateTime(s.scheduled_at)}</span>
                      <span className="text-xs text-grey-3 italic">
                        ({s.status})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {upcomingSessions.length === 0 && pastSessions.length === 0 && (
              <p className="text-grey-3 text-sm">
                No coaching sessions on file yet. Coaching calls show up here automatically once you book through the portal scheduler.
              </p>
            )}
          </Card>

          {/* ===== Help & support ===== */}
          <Card title="Need a hand?" icon={Mail}>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                  Email support
                </div>
                <a
                  href="mailto:team@thefranchisorblueprint.com"
                  className="text-navy font-semibold hover:text-gold-warm transition-colors"
                >
                  team@thefranchisorblueprint.com
                </a>
                <p className="text-grey-3 text-xs mt-1">
                  30 days of email support included with every purchase.
                </p>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                  Billing & cancellation
                </div>
                <p className="text-grey-3 text-sm leading-relaxed">
                  All purchases are non-refundable once access is granted. For installment plans, all installments are non-refundable once the first payment processes; remaining installments continue on schedule. Billing question? Email{" "}
                  <a
                    href="mailto:info@thefranchisorblueprint.com?subject=Billing%20question"
                    className="text-navy font-semibold underline"
                  >
                    info@thefranchisorblueprint.com
                  </a>
                  .
                </p>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-navy/5 flex items-center gap-2 text-xs text-grey-3">
              <ShieldCheck size={14} className="text-gold" />
              <span>
                Your account is protected by single-use magic-link authentication —
                no passwords to remember or compromise.
              </span>
            </div>
          </Card>

          {/* Sign out — relocated here from the sidebar so the rail
              stays focused on navigation rather than session controls. */}
          <Card title="Sign out" icon={LogOut}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-grey-3 text-sm max-w-[480px]">
                Ends your session here. You can sign back in any time
                with a fresh magic link to your email.
              </p>
              <form action="/api/portal/logout" method="POST">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-white text-navy border-2 border-navy/30 hover:border-navy hover:bg-navy hover:text-cream font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </form>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-card-border shadow-[0_8px_24px_rgba(30,58,95,0.06)] p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={18} className="text-gold" />
        <h2 className="text-navy font-bold text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
        {label}
      </div>
      <div className="text-navy text-sm">{children}</div>
    </div>
  );
}

function FlashBanner({
  kind,
  message,
}: {
  kind: "success" | "warn" | "error";
  message: string;
}) {
  const Icon =
    kind === "success" ? CheckCircle2 : kind === "warn" ? RefreshCw : XCircle;
  const stylesByKind: Record<typeof kind, string> = {
    success: "bg-green-50 border-green-200 text-green-800",
    warn: "bg-cream border-gold/40 text-navy",
    error: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${stylesByKind[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
