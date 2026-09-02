import { NextResponse } from "next/server";
import { getMyStampedDocumentUrl } from "@/lib/supabase/agreements/my-agreements";

/**
 * Student "Download stamped agreement" — mirrors
 * src/app/(site)/agreements/[id]/signed-document/route.ts's shape exactly
 * (Milestone 11-A, F-123). getMyStampedDocumentUrl() re-derives ownership
 * from the signed-in student's own session (never a client-supplied id
 * alone) before ever generating a signed Storage URL — see that
 * function's own docblock. A student can never reach another student's
 * stamped document by editing this URL's [id] segment: an id that exists
 * but belongs to someone else resolves to `null` here, identically to an
 * id that does not exist at all.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const url = await getMyStampedDocumentUrl(id);
  if (!url) return NextResponse.json({ error: "Stamped document not available." }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
