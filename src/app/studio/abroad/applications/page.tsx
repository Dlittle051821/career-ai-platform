import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/supabase/profile";
import { listMyApplications, getMyApplicationHistory } from "@/lib/supabase/education/applications";
import { listMyOpenApplicationTasks } from "@/lib/supabase/education/application-tasks";
import { isAbroadDestinationName } from "@/lib/abroad/scope";
import { getApplicationBucket } from "@/lib/applications/application-lifecycle";
import { isApplicationTaskStatus, summarizeApplicationTasks, type ApplicationTaskStatus } from "@/lib/applications/application-tasks";
import { getUpcomingApplicationDeadlines, mergeRecentApplicationActivity, type UpcomingDeadlineInput } from "@/lib/applications/application-dashboard";
import { APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/types/admin";
import { AbroadApplicationsSummaryTiles } from "@/components/abroad/AbroadApplicationsSummaryTiles";
import { UpcomingAbroadDeadlinesCard } from "@/components/abroad/UpcomingAbroadDeadlinesCard";
import { AbroadActionRequiredCard } from "@/components/abroad/AbroadActionRequiredCard";
import { RecentAbroadActivityCard } from "@/components/abroad/RecentAbroadActivityCard";
import { AbroadApplicationsTable } from "@/components/abroad/AbroadApplicationsTable";

export const metadata: Metadata = {
  title: "Abroad Applications",
  robots: { index: false, follow: false },
};

function applicationTitle(application: { courseName: string | null; universityName: string | null }): string {
  return application.courseName && application.universityName
    ? `${application.courseName} at ${application.universityName}`
    : (application.courseName ?? application.universityName ?? "University/course record no longer available");
}

/**
 * NW06.2 — the Abroad Application Dashboard (`/studio/abroad/applications`).
 *
 * Per NW06_01_EXISTING_SYSTEM_AUDIT.md §5, this page introduces NO new
 * read beyond the two already built for NW06.6 (listMyOpenApplicationTasks())
 * and the pre-existing, unchanged Milestone 16 reads
 * (listMyApplications()/getMyApplicationHistory()) — everything here is
 * composition and Abroad-filtering (via isAbroadDestinationName(), the
 * same single source of truth `/studio/abroad` itself uses), never a
 * second data model. The generic, product-agnostic `/applications` list
 * and `/applications/[id]` detail pages remain the actual read/write
 * surface for any one application (including its Tasks, Documents, and
 * Actions); this page is a dashboard ON TOP of that, not a replacement
 * for it — every card/row here links back to `/applications/[id]` for
 * detail or action.
 */
export default async function AbroadApplicationsDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/studio/abroad/applications");

  const [applications, openTasks] = await Promise.all([listMyApplications(), listMyOpenApplicationTasks()]);
  const abroadApplications = applications.filter((a) => isAbroadDestinationName(a.universityCountryName));
  const abroadApplicationIds = new Set(abroadApplications.map((a) => a.id));
  const abroadOpenTasks = openTasks.filter((t) => abroadApplicationIds.has(t.applicationId));

  const applicationLabelById = new Map(abroadApplications.map((a) => [a.id, applicationTitle(a)]));

  const taskSummary = summarizeApplicationTasks(
    abroadOpenTasks.filter((t) => isApplicationTaskStatus(t.status)).map((t) => ({ id: t.id, status: t.status as ApplicationTaskStatus, dueDate: t.dueDate }))
  );

  const activeCount = abroadApplications.filter((a) => getApplicationBucket(a.stage) === "active").length;

  const deadlineInputs: UpcomingDeadlineInput[] = abroadApplications
    .filter((a) => a.resolvedDeadline !== null)
    .map((a) => ({ applicationId: a.id, label: applicationTitle(a), stage: a.stage, deadline: a.resolvedDeadline! }));
  const upcomingDeadlines = getUpcomingApplicationDeadlines(deadlineInputs, new Date(), 5);

  const historyByApplication = await Promise.all(
    abroadApplications.map(async (a) => ({ application: a, history: await getMyApplicationHistory(a.id) }))
  );
  const recentActivity = mergeRecentApplicationActivity(
    historyByApplication.flatMap(({ application, history }) =>
      history.map((h) => ({
        id: h.id,
        applicationId: application.id,
        applicationLabel: applicationTitle(application),
        message: h.studentVisibleMessage ?? `Status changed to "${APPLICATION_STAGE_LABELS[h.toStatus as ApplicationStage] ?? h.toStatus}".`,
        createdAt: h.createdAt,
      }))
    ),
    8
  );

  if (abroadApplications.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link href="/studio/abroad" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to Nextwise Abroad
        </Link>
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <ClipboardList aria-hidden="true" className="h-9 w-9 text-muted" />
          <h1 className="text-xl font-semibold text-primary">No Abroad applications yet</h1>
          <p className="max-w-sm text-sm text-muted">
            Once you start an application for a course in one of Nextwise Abroad&apos;s six launch destinations, it will
            show up here with its deadlines, tasks, and status.
          </p>
          <LinkButton href="/courses" size="sm" className="mt-2">
            Explore courses
          </LinkButton>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href="/studio/abroad" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to Nextwise Abroad
        </Link>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">Abroad Applications</h1>
        <p className="mt-2 text-base text-muted">
          Every application you&apos;ve started across Nextwise Abroad&apos;s six launch destinations — deadlines,
          tasks, and recent updates, all in one place.
        </p>
      </div>

      <AbroadApplicationsSummaryTiles
        totalCount={abroadApplications.length}
        activeCount={activeCount}
        actionRequiredCount={taskSummary.actionableCount}
        overdueCount={taskSummary.overdueCount}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <UpcomingAbroadDeadlinesCard deadlines={upcomingDeadlines} />
        <AbroadActionRequiredCard tasks={abroadOpenTasks} applicationLabelById={applicationLabelById} />
      </div>

      <RecentAbroadActivityCard entries={recentActivity} />

      <AbroadApplicationsTable applications={abroadApplications} />
    </div>
  );
}
