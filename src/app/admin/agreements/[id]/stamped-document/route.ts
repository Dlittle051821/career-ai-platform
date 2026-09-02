import { NextResponse } from "next/server";
import { getAdminStampedDocumentUrlForAgreement } from "@/lib/supabase/admin/stamping";
import { AdminAuthorizationError } from "@/lib/supabase/admin-auth";

/**
 * Admin "View stamped agreement" download — mirrors
 * src/app/admin/agreements/[id]/signed-document/route.ts exactly. Generates
 * a fresh, short-lived signed Storage URL on every request and redirects
 * to it; never embeds a long-lived URL in page HTML. Permission-gated
 * inside getAdminStampedDocumentUrlForAgreement (agreements:read).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;

  let url: string | null;
  try {
    url = await getAdminStampedDocumentUrlForAgreement(id);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  if (!url) return NextResponse.json({ error: "Stamped document not available." }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
