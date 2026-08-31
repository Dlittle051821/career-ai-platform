import { NextResponse } from "next/server";
import { getAdminSignedDocumentUrlForAgreement } from "@/lib/supabase/admin/signatures";
import { AdminAuthorizationError } from "@/lib/supabase/admin-auth";

/**
 * Admin "View signed agreement" download — generates a fresh, short-lived
 * signed Storage URL on every request and redirects to it; never embeds a
 * long-lived URL in page HTML. Permission-gated inside
 * getAdminSignedDocumentUrlForAgreement (agreements:read), same "data
 * access is the boundary" convention as src/app/admin/invoices/[id]/pdf/route.ts.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;

  let url: string | null;
  try {
    url = await getAdminSignedDocumentUrlForAgreement(id);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  if (!url) return NextResponse.json({ error: "Signed document not available." }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
