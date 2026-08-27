import type { Metadata } from "next";
import Link from "next/link";
import { Contact, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Select } from "@/components/forms/Select";
import { Input } from "@/components/forms/Input";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listLeads } from "@/lib/supabase/admin/leads";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/types/admin";

export const metadata: Metadata = { title: "Leads" };

const STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing", "converted", "lost"];

interface LeadsPageProps {
  searchParams: Promise<{ q?: string; stage?: string; page?: string }>;
}

export default async function AdminLeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const stageParam = params.stage ?? "";
  const stage = STAGES.includes(stageParam as LeadStage) ? (stageParam as LeadStage) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listLeads({ query: query || undefined, stage, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (stage) activeFilters.stage = stage;
  const hasActiveFilters = Boolean(query || stage);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Leads</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Lead management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            No real email, SMS, or WhatsApp is sent from here — every action recorded here is internal
            record-keeping only. A counsellor sees only their assigned leads.
          </p>
        </div>
        <LinkButton href="/admin/leads/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New lead
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/leads" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Name, email, or phone" />
          </FormField>
          <FormField id="stage" label="Stage">
            <Select id="stage" name="stage" defaultValue={stage ?? ""}>
              <option value="">All</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={hasActiveFilters ? "No leads match your filters" : "No leads yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Add the first lead to start tracking the funnel."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/leads" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/leads/new" size="sm">
                New lead
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} lead{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Lead", "Contact", "Stage", "Priority", "Counsellor", ""]}>
            {result.items.map((l) => (
              <tr key={l.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/leads/${l.id}`} className="hover:text-primary hover:underline">
                    {l.fullName}
                  </Link>
                </Td>
                <Td className="text-text-soft">{l.email || l.phone || "—"}</Td>
                <Td>
                  <StatusBadge status={l.stage} labelOverride={LEAD_STAGE_LABELS[l.stage]} />
                </Td>
                <Td>
                  <StatusBadge status={l.priority} />
                </Td>
                <Td className="text-text-soft">{l.assignedCounsellorName ?? "Unassigned"}</Td>
                <Td>
                  <Link href={`/admin/leads/${l.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/leads" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
