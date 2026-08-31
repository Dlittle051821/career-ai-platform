import { NextResponse } from "next/server";
import { getImportBatchById, exportRejectedRowsCsv } from "@/lib/supabase/admin/education-imports";
import { AdminAuthorizationError } from "@/lib/supabase/admin-auth";

/**
 * Downloads the rejected (status='error') rows of an import batch as CSV,
 * mirroring src/app/admin/invoices/[id]/pdf/route.ts's shape. Permission-
 * gated inside getImportBatchById/exportRejectedRowsCsv (both call
 * requireAdminPermission("education-imports:read")) — this route has no
 * separate check of its own, same "data access is the boundary" convention.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;

  let batch;
  try {
    batch = await getImportBatchById(id);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  if (!batch) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });

  const csv = await exportRejectedRowsCsv(id);
  const safeFileName = (batch.fileName ?? id).replace(/[^a-zA-Z0-9._-]/g, "_");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rejected-${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
