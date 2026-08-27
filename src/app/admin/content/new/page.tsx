import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ContentItemForm } from "@/components/admin/content/ContentItemForm";
import { createContentItemAction } from "../actions";

export const metadata: Metadata = { title: "New Content Item" };

export default function NewContentItemPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/content" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to content
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Content</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New content item</h1>
      </div>
      <ContentItemForm action={createContentItemAction} submitLabel="Create content item" />
    </div>
  );
}
