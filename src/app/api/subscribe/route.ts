import { NextRequest, NextResponse } from "next/server";
import { acUpsertContact, AC_MASTER_LIST_ID } from "@/lib/activecampaign";

export const runtime = "nodejs";

/**
 * Receives the /blog newsletter signup POST. Pushes the email into
 * ActiveCampaign with the source-blog-newsletter tag, then redirects
 * back to /blog with ?subscribed=1 so the page can show a success banner.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.redirect(new URL("/blog?error=email", req.url), 303);
  }

  try {
    await acUpsertContact({
      email,
      listIds: AC_MASTER_LIST_ID ? [AC_MASTER_LIST_ID] : [],
      tags: ["source-blog-newsletter"],
    });
  } catch (err) {
    console.error("[subscribe] AC push failed:", err);
  }

  return NextResponse.redirect(new URL("/blog?subscribed=1", req.url), 303);
}
