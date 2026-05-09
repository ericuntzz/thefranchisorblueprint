/**
 * Per-section redline detail.
 *
 *   /portal/admin/redline/[userId]/[slug]
 *
 * Renders the customer's current section draft + structured fields and
 * surfaces every redline thread so the admin reviewer can leave new
 * notes, resolve old ones, and stamp the section approved.
 *
 * Auth: ADMIN_USER_IDS gate.
 */

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedAdminId } from "@/lib/admin";
import {
  isValidMemoryFileSlug,
  MEMORY_FILE_TITLES,
} from "@/lib/memory/files";
import type {
  SectionRedline,
  CustomerMemory,
  Profile,
} from "@/lib/supabase/types";
import { RedlineThread } from "./RedlineThread";

export const metadata: Metadata = {
  title: "Admin · Section redline | The Franchisor Blueprint",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ userId: string; slug: string }>;
};

export default async function AdminRedlineSectionPage({ params }: Props) {
  const { userId, slug } = await params;
  if (!isValidMemoryFileSlug(slug)) notFound();

  const adminId = await getAuthenticatedAdminId();
  if (!adminId) redirect("/portal");

  const admin = getSupabaseAdmin();
  const [{ data: profile }, { data: row }, { data: redlines }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("customer_memory")
        .select("*")
        .eq("user_id", userId)
        .eq("file_slug", slug)
        .maybeSingle(),
      admin
        .from("section_redlines")
        .select("*")
        .eq("user_id", userId)
        .eq("section_slug", slug)
        .order("created_at", { ascending: false }),
    ]);

  if (!profile) notFound();

  const customer = profile as Pick<Profile, "id" | "full_name" | "email">;
  const memoryRow = (row ?? null) as CustomerMemory | null;
  const initialRedlines = (redlines ?? []) as SectionRedline[];

  return (
    <main className="min-h-[calc(100vh-200px)] bg-cream-soft">
      <div className="border-b border-navy/10 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-3 flex items-center gap-3">
          <Link
            href="/portal/admin/redline"
            className="inline-flex items-center gap-1.5 text-navy bg-white hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors"
          >
            <ArrowLeft size={12} />
            Back to queue
          </Link>
          <span className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
            {customer.full_name ?? customer.email} · {MEMORY_FILE_TITLES[slug]}
          </span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-8 grid lg:grid-cols-[1fr_400px] gap-8">
        <div>
          <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-1">
            {MEMORY_FILE_TITLES[slug]}
          </h1>
          <p className="text-grey-3 text-sm leading-relaxed mb-6">
            Customer: <strong>{customer.full_name ?? customer.email}</strong>
          </p>
          <article className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6">
            <h2 className="text-[10px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2">
              Current draft
            </h2>
            <pre className="whitespace-pre-wrap font-sans text-navy text-sm leading-relaxed">
              {memoryRow?.content_md?.trim() || "(no prose yet)"}
            </pre>
          </article>
          <article className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6 mt-4">
            <h2 className="text-[10px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2">
              Structured fields
            </h2>
            {memoryRow?.fields &&
            Object.keys(memoryRow.fields).length > 0 ? (
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {Object.entries(memoryRow.fields).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2 border-b border-navy/5 py-1">
                    <dt className="text-grey-3 font-mono text-xs">{k}</dt>
                    <dd className="text-navy text-right break-words">
                      {Array.isArray(v) ? v.join(", ") : v == null ? "—" : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-grey-3 text-sm">
                No structured fields set yet.
              </p>
            )}
          </article>
        </div>

        <RedlineThread
          userId={userId}
          slug={slug}
          initialRedlines={initialRedlines}
          jasonApprovedAt={memoryRow?.jason_approved_at ?? null}
        />
      </div>
    </main>
  );
}
