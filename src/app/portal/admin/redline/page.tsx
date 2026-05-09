/**
 * Admin Redline UI — Tier 2/3 review surface.
 *
 * Lists every paid customer and their per-section readiness, with a
 * per-section "open redline thread" link. Inside a thread the admin
 * sees the section's current draft, leaves redline notes (info /
 * warning / blocker), and stamps the section approved when ready.
 *
 * Auth: ADMIN_USER_IDS gate. Non-admins get redirected to the regular
 * portal.
 */

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Stamp, MessageSquare, AlertTriangle } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedAdminId } from "@/lib/admin";
import {
  computeSectionReadiness,
  indexMemoryRows,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import {
  MEMORY_FILES,
  MEMORY_FILE_TITLES,
} from "@/lib/memory/files";
import type {
  SectionRedline,
  CustomerMemory,
  Profile,
} from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Admin · Redline | The Franchisor Blueprint",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminRedlinePage() {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    // Not an admin → bounce to portal so we don't reveal the surface
    // exists. notFound() would also work; redirect feels cleaner.
    redirect("/portal");
  }

  const admin = getSupabaseAdmin();
  // Pull every paid customer with their profile + memory + open redline counts.
  const [{ data: profiles }, { data: paid }, { data: memory }, { data: redlines }] =
    await Promise.all([
      admin.from("profiles").select("id, full_name, email"),
      admin.from("purchases").select("user_id").eq("status", "paid"),
      admin
        .from("customer_memory")
        .select("user_id, file_slug, content_md, fields, confidence, attachments, jason_approved_at"),
      admin
        .from("section_redlines")
        .select("user_id, section_slug, resolved_at, severity"),
    ]);

  const paidUserIds = new Set(
    ((paid ?? []) as Array<{ user_id: string }>).map((p) => p.user_id),
  );
  const customers = ((profiles ?? []) as Pick<Profile, "id" | "full_name" | "email">[])
    .filter((p) => paidUserIds.has(p.id))
    .sort((a, b) =>
      (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
    );

  // Index memory + redlines by user.
  const memoryByUser = new Map<string, CustomerMemory[]>();
  for (const row of (memory ?? []) as CustomerMemory[]) {
    const arr = memoryByUser.get(row.user_id) ?? [];
    arr.push(row);
    memoryByUser.set(row.user_id, arr);
  }
  const redlinesByUser = new Map<string, Pick<SectionRedline, "section_slug" | "resolved_at" | "severity">[]>();
  for (const r of (redlines ?? []) as Pick<SectionRedline, "user_id" | "section_slug" | "resolved_at" | "severity">[]) {
    const arr = redlinesByUser.get(r.user_id) ?? [];
    arr.push({ section_slug: r.section_slug, resolved_at: r.resolved_at, severity: r.severity });
    redlinesByUser.set(r.user_id, arr);
  }

  return (
    <main className="min-h-[calc(100vh-200px)] bg-cream-soft">
      <div className="border-b border-navy/10 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-3 flex items-center gap-3">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-navy bg-white hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors"
          >
            <ArrowLeft size={12} />
            Back to portal
          </Link>
          <span className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
            Admin · Redline
          </span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-8 md:py-12">
        <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-1">
          Customer redline queue
        </h1>
        <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-8 max-w-[640px]">
          Every paid customer with at least one Memory section. Click any
          section to leave redline notes; once every blocker is resolved,
          stamp the section approved and the export bundles will reflect it.
        </p>

        <div className="grid gap-3">
          {customers.length === 0 && (
            <div className="rounded-xl border border-navy/10 bg-white p-6 text-grey-3 text-sm">
              No paid customers yet.
            </div>
          )}
          {customers.map((c) => {
            const rows = memoryByUser.get(c.id) ?? [];
            const indexed = indexMemoryRows(
              rows.map((r) => ({
                file_slug: r.file_slug,
                content_md: r.content_md,
                fields: r.fields,
                confidence: r.confidence,
                attachments: r.attachments ?? [],
              })),
            );
            const readiness = computeSectionReadiness(indexed);
            const overall = overallReadinessPct(readiness);
            const userRedlines = redlinesByUser.get(c.id) ?? [];
            const openCount = userRedlines.filter((r) => !r.resolved_at).length;
            const openBlockers = userRedlines.filter(
              (r) => !r.resolved_at && r.severity === "blocker",
            ).length;
            const approvedCount = rows.filter((r) => r.jason_approved_at).length;
            return (
              <article
                key={c.id}
                className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-navy font-bold text-base">
                      {c.full_name ?? c.email}
                    </h2>
                    <div className="text-xs text-grey-4">{c.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="text-navy font-bold">
                      {overall}% complete
                    </span>
                    <span className="text-grey-3">
                      {approvedCount} / {MEMORY_FILES.length} approved
                    </span>
                    {openCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        <MessageSquare size={11} />
                        {openCount} open
                      </span>
                    )}
                    {openBlockers > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        <AlertTriangle size={11} />
                        {openBlockers} blocker{openBlockers === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {MEMORY_FILES.map((slug) => {
                    const row = rows.find((r) => r.file_slug === slug);
                    const status = readiness[slug];
                    const open = userRedlines.filter(
                      (r) => r.section_slug === slug && !r.resolved_at,
                    ).length;
                    const approved = !!row?.jason_approved_at;
                    return (
                      <Link
                        key={slug}
                        href={`/portal/admin/redline/${c.id}/${slug}`}
                        className="rounded-lg border border-navy/10 bg-cream/40 hover:border-gold hover:bg-gold/5 p-3 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {approved && (
                            <Stamp size={12} className="text-emerald-700 flex-shrink-0" />
                          )}
                          <span className="text-navy font-bold text-xs leading-tight">
                            {MEMORY_FILE_TITLES[slug]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-grey-3">
                          <span>
                            {status
                              ? `${status.filledRequired}/${status.totalRequired}`
                              : "0/0"}
                          </span>
                          {open > 0 ? (
                            <span className="font-bold text-amber-700">
                              {open} open
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// Suppress notFound import lint — kept available for future use when
// we want to 404 instead of redirect on non-admins.
void notFound;
