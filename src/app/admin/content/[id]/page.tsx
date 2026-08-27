import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ContentItemForm } from "@/components/admin/content/ContentItemForm";
import { getContentItemById } from "@/lib/supabase/admin/content-items";
import { updateContentItemAction } from "../actions";

interface ContentItemDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Content Item" };

export default async function ContentItemDetailPage({ params }: ContentItemDetailPageProps) {
  const { id } = await params;
  const item = await getContentItemById(id);
  if (!item) notFound();

  const boundAction = updateContentItemAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/content" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to content
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Content</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{item.title}</h1>
        <p className="mt-2 text-sm text-muted">
          Last updated {new Date(item.updatedAt).toLocaleString("en-IN")}
          {item.publishedAt ? ` · Published ${new Date(item.publishedAt).toLocaleString("en-IN")}` : ""}
        </p>
      </div>
      <ContentItemForm action={boundAction} defaultValues={item} submitLabel="Save changes" />
    </div>
  );
}
