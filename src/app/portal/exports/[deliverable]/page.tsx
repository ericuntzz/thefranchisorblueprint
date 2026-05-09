/**
 * /portal/exports/[deliverable] — preserved as a redirect.
 *
 * The pre-export review surface (document readiness bar, source
 * chapters with state, required gaps list, live markdown preview,
 * .docx + .md downloads) was merged into the deliverable cards on
 * the dashboard. The customer no longer needs to navigate to a
 * separate page to review and ship; everything happens inline.
 *
 * This route stays as a redirect so:
 *   - Old browser bookmarks resolve cleanly.
 *   - Email links pointing here still land somewhere reasonable.
 *   - Anyone reaching here from search lands on the dashboard with
 *     a hash fragment that the deliverable card can scroll/expand
 *     to (handled client-side; harmless if it doesn't match).
 */

import { redirect } from "next/navigation";
import { isValidDeliverableId } from "@/lib/export/deliverables";

interface Props {
  params: Promise<{ deliverable: string }>;
}

export default async function PreExportReviewPage({ params }: Props) {
  const { deliverable: deliverableId } = await params;
  // Land them on /portal with a hash so a future enhancement (or an
  // existing scroll-into-view) can deep-link to the right card.
  // Invalid ids just bounce to the dashboard root.
  if (isValidDeliverableId(deliverableId)) {
    redirect(`/portal#deliverable-${deliverableId}`);
  }
  redirect("/portal");
}
