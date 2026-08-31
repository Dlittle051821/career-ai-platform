import { NextResponse } from "next/server";
import { getMySignedDocumentUrl } from "@/lib/supabase/agreements/my-agreements";

/**
 * Student "Download signed agreement" — mirrors src/app/(site)/payments/
 * [invoiceId]/pdf/route.ts's shape. getMySignedDocumentUrl() re-derives
 * ownership from the signed-in student's own session (never a
 * client-supplied id alone) before ever generating a signed Storage URL —
 * see src/lib/supabase/agreements/my-agreements.ts's own docblock. A
 * student can never reach another student's signed document by editing
 * this URL's [id] segment: an id that exists but belongs to someone else
 * resolves to `null` here, identically to an id that does not exist at
 * all.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const url = await getMySignedDocumentUrl(id);
  if (!url) return NextResponse.json({ error: "Signed document not available." }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
