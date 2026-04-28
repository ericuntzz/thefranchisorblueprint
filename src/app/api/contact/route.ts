import { NextRequest, NextResponse } from "next/server";
import { acUpsertContact, AC_MASTER_LIST_ID, buildFieldValues } from "@/lib/activecampaign";

export const runtime = "nodejs";

/**
 * Receives the /contact form POST. Pushes the submission into ActiveCampaign
 * (master list + tags), then 303-redirects the browser to the thank-you page.
 *
 * Soft-fails: if AC isn't configured or the API call errors, we still
 * 303 to thank-you so the user isn't penalized — Eric checks server logs.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const businessName = String(form.get("business") ?? "").trim();
  const annualRevenue = String(form.get("revenue") ?? "").trim();
  const programInterest = String(form.get("program") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  // Basic validation: real email + required fields. Bad submits get bounced
  // back to the form with an error query param so the page can show a banner.
  if (!email || !email.includes("@")) {
    return NextResponse.redirect(new URL("/contact?error=email", req.url), 303);
  }
  if (!firstName || !lastName || !businessName) {
    return NextResponse.redirect(new URL("/contact?error=missing", req.url), 303);
  }

  // Map the program-interest dropdown string → the tier-tag form everyone else uses.
  const interestTag = programInterest.includes("Blueprint")
    ? "interest-blueprint"
    : programInterest.includes("Navigator")
      ? "interest-navigator"
      : programInterest.includes("Builder")
        ? "interest-builder"
        : "interest-not-sure";

  try {
    await acUpsertContact({
      email,
      firstName,
      lastName,
      fieldValues: buildFieldValues({
        businessName,
        annualRevenue,
        programInterest,
        message,
      }),
      listIds: AC_MASTER_LIST_ID ? [AC_MASTER_LIST_ID] : [],
      tags: ["source-contact-form", interestTag],
    });
  } catch (err) {
    // Don't block the user — log and continue.
    console.error("[contact] AC push failed:", err);
  }

  return NextResponse.redirect(new URL("/contact/thank-you", req.url), 303);
}
