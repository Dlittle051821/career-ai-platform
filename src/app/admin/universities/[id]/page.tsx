import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UniversityForm } from "@/components/admin/universities/UniversityForm";
import { PublicationWorkflowCard } from "@/components/admin/universities/PublicationWorkflowCard";
import { CampusForm } from "@/components/admin/universities/CampusForm";
import { AddScholarshipForm } from "@/components/admin/universities/AddScholarshipForm";
import { Card } from "@/components/ui/Card";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getUniversityById } from "@/lib/supabase/admin/universities";
import { listCountryOptions } from "@/lib/supabase/admin/education-countries";
import { listCampusesForUniversity } from "@/lib/supabase/admin/education-campuses";
import { listScholarshipsForUniversity } from "@/lib/supabase/admin/education-scholarships";
import {
  updateUniversityAction,
  submitUniversityForReviewAction,
  publishUniversityAction,
  archiveUniversityAction,
  restoreUniversityToDraftAction,
} from "../actions";
import { createCampusAction } from "./campuses/actions";
import { deleteScholarshipAction } from "./scholarships/actions";

interface UniversityDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit University" };

function formatAmount(minorUnits: number | null, currencyCode: string | null): string {
  if (minorUnits === null) return "—";
  const amount = (minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currencyCode ? `${currencyCode} ${amount}` : amount;
}

export default async function UniversityDetailPage({ params }: UniversityDetailPageProps) {
  const { id } = await params;
  const university = await getUniversityById(id);
  if (!university) notFound();

  const [countryOptions, campuses, scholarships] = await Promise.all([
    listCountryOptions(),
    listCampusesForUniversity(id),
    listScholarshipsForUniversity(id),
  ]);

  const boundAction = updateUniversityAction.bind(null, id);
  const submitForReviewAction = submitUniversityForReviewAction.bind(null, id);
  const publishAction = publishUniversityAction.bind(null, id);
  const archiveAction = archiveUniversityAction.bind(null, id);
  const restoreAction = restoreUniversityToDraftAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/universities" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to universities
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Universities</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{university.name}</h1>
        <p className="mt-2 text-sm text-muted">
          Last updated {new Date(university.updatedAt).toLocaleString("en-IN")}
        </p>
      </div>

      <UniversityForm action={boundAction} defaultValues={university} countryOptions={countryOptions} submitLabel="Save changes" />

      <div className="mt-6 space-y-6">
        <PublicationWorkflowCard
          status={university.publicationStatus}
          onSubmitForReview={submitForReviewAction}
          onPublish={publishAction}
          onArchive={archiveAction}
          onRestore={restoreAction}
        />

        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Campuses</h2>
            <p className="mt-1 text-sm text-muted">Physical locations for this university.</p>
          </div>

          {campuses.length === 0 ? (
            <p className="text-sm text-muted">No campuses yet.</p>
          ) : (
            <AdminTable headers={["Name", "City", "Main", "Active", ""]}>
              {campuses.map((c) => (
                <tr key={c.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">
                    <Link href={`/admin/universities/${id}/campuses/${c.id}`} className="hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="text-text-soft">{[c.city, c.countryName].filter(Boolean).join(", ") || "—"}</Td>
                  <Td>{c.isMain ? <StatusBadge status="active" labelOverride="Main" /> : <span className="text-muted">—</span>}</Td>
                  <Td>
                    <StatusBadge status={c.isActive ? "active" : "inactive"} />
                  </Td>
                  <Td>
                    <Link href={`/admin/universities/${id}/campuses/${c.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                      Edit
                    </Link>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">Add campus</h3>
            <CampusForm action={createCampusAction} universityId={id} countryOptions={countryOptions} submitLabel="Add campus" />
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-primary">Scholarships</h2>
            <p className="mt-1 text-sm text-muted">Scholarships offered university-wide (not tied to a specific course).</p>
          </div>

          {scholarships.length === 0 ? (
            <p className="text-sm text-muted">No scholarships yet.</p>
          ) : (
            <AdminTable headers={["Name", "Award", "Deadline", "Active", ""]}>
              {scholarships.map((s) => (
                <tr key={s.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">{s.name}</Td>
                  <Td className="text-text-soft">{formatAmount(s.awardAmountMinorUnits, s.currencyCode)}</Td>
                  <Td className="text-text-soft">{s.deadline ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={s.isActive ? "active" : "inactive"} />
                  </Td>
                  <Td>
                    <form action={deleteScholarshipAction}>
                      <input type="hidden" name="scholarshipId" value={s.id} />
                      <input type="hidden" name="universityId" value={id} />
                      <SubmitButton savingLabel="Deleting…">Delete</SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          )}

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">Add scholarship</h3>
            <AddScholarshipForm universityId={id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
