import type { Metadata } from "next";
import { Bookmark, ClipboardList, Compass, FileSignature, LibraryBig, Mail, Map, Phone, Receipt, Sparkles, Tag, UserRound } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { LinkButton } from "@/components/ui/Button";
import { ProfileProgressBar } from "@/components/sections/profile/ProfileProgressBar";
import { getCurrentProfile, firstNameFrom } from "@/lib/supabase/profile";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { listMyInvoices } from "@/lib/supabase/payments/student-invoices";
import { listMyPurchases } from "@/lib/supabase/pricing/my-purchases";
import { listMyAgreements } from "@/lib/supabase/agreements/my-agreements";
import { INVOICE_STATUS_LABELS, PAYABLE_INVOICE_STATUSES } from "@/types/payments";
import { formatMoney } from "@/lib/admin/money";
import { listSavedItems } from "@/lib/supabase/education/saved-items";
import { listMyApplications } from "@/lib/supabase/education/applications";
import { getMyActiveDiscoverySession } from "@/lib/supabase/discovery-sessions/book";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { getMyRecommendationReadiness } from "@/lib/supabase/recommendation-readiness";
import { ReadinessBadge } from "@/components/sections/recommendations/ReadinessBadge";
import { BRAND_NAME } from "@/config/site";

const STUDENT_PROFILE_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Complete",
};

export const metadata: Metadata = {
  title: "Dashboard",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  // No manual redirect needed here — the middleware already sends
  // logged-out visitors to /login before this page ever renders. This
  // fetch just gets the real, logged-in student's data to display.
  const profile = await getCurrentProfile();
  const firstName = firstNameFrom(profile);

  const studentSnapshot = await getStudentProfileSnapshot();
  const studentCompletion = studentSnapshot
    ? calculateCompletion(studentSnapshot)
    : { percent: 0, status: "not_started" as const, sections: [] };

  const invoices = await listMyInvoices();
  const payableInvoices = invoices.filter((inv) => PAYABLE_INVOICE_STATUSES.includes(inv.status));
  const totalDueMinorUnits = payableInvoices.reduce((sum, inv) => sum + inv.dueMinorUnits, 0);
  const purchases = await listMyPurchases();
  const agreements = await listMyAgreements();

  const savedItems = await listSavedItems();
  const savedUniversityCount = savedItems.filter((i) => i.entityType === "university").length;
  const savedCourseCount = savedItems.filter((i) => i.entityType === "course").length;

  const applications = await listMyApplications();
  const activeDiscoverySession = await getMyActiveDiscoverySession();
  const recommendationReadiness = await getMyRecommendationReadiness();
  const careerReadiness = recommendationReadiness?.career ?? null;

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          This is your account home. Your Career Recommendations below are real and based on your Student Digital
          Profile — the roadmap and counselling sections are still illustrative demo content.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-primary">Your account</h2>
            <Badge tone="success">Active</Badge>
          </div>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <UserRound aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Full name</dt>
                <dd className="text-sm font-medium text-text">{profile?.fullName ?? "Not set"}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Mail aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
                <dd className="text-sm font-medium text-text">{profile?.email ?? "Not set"}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Phone aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Phone</dt>
                <dd className="text-sm font-medium text-text">{profile?.phone ?? "Not set"}</dd>
              </div>
            </div>
          </dl>
        </Card>

        <Card>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-accent-dark">
            <Map aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-primary">Your roadmap</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A sample, illustrative career-to-course roadmap based on the {BRAND_NAME} journey.
          </p>
          <LinkButton href="/roadmap" size="sm" variant="outline" className="mt-4 w-full justify-center">
            View roadmap
          </LinkButton>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <Compass aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Career recommendations</h2>
                <Badge tone="success">Real</Badge>
                {careerReadiness && <ReadinessBadge level={careerReadiness.level} />}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {careerReadiness && careerReadiness.level === "NOT_READY"
                  ? "Add a bit more to your profile — subjects, interests, or skills — to unlock reliable career recommendations."
                  : "Careers ranked against your Student Digital Profile, with plain-language reasons for each one — a structured decision-support tool, not a scientific or AI-generated assessment."}
              </p>
              <LinkButton href="/recommendations" size="sm" className="mt-4">
                View my recommendations
              </LinkButton>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            {activeDiscoverySession ? <Badge tone="success">Real</Badge> : null}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-primary">Discovery Session</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {activeDiscoverySession
              ? `Your free Discovery Session is ${DISCOVERY_SESSION_STATUS_LABELS[activeDiscoverySession.status].toLowerCase()}.${activeDiscoverySession.assignedCounsellorName ? ` ${activeDiscoverySession.assignedCounsellorName} is assigned to you.` : ""}`
              : "A free, no-obligation first conversation with a counsellor — a good place to start if you'd rather talk it through than fill in a form."}
          </p>
          <LinkButton href="/discovery-session/book" size="sm" variant="outline" className="mt-4 w-full justify-center">
            {activeDiscoverySession ? "View my Discovery Session" : "Book my free Discovery Session"}
          </LinkButton>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Receipt aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Payments</h2>
                {payableInvoices.length > 0 ? <Badge tone="warning">{payableInvoices.length} due</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {payableInvoices.length > 0
                  ? `${formatMoney(totalDueMinorUnits, payableInvoices[0].currency)} due across ${payableInvoices.length} invoice${payableInvoices.length === 1 ? "" : "s"}.`
                  : invoices.length > 0
                    ? "No outstanding invoices right now."
                    : "No invoices yet — they will appear here once one is issued to you."}
              </p>
            </div>
          </div>
          <LinkButton href="/payments" size="sm" variant="outline" className="shrink-0">
            View payments
          </LinkButton>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Tag aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-primary">My plans</h2>
            <p className="mt-1 text-sm text-muted">
              {purchases.length === 0 ? "No plan purchased yet — see our pricing to get started." : `${purchases.length} plan${purchases.length === 1 ? "" : "s"} purchased.`}
            </p>
            {purchases.length === 0 ? (
              <LinkButton href="/pricing" size="sm" variant="outline" className="mt-4">
                View pricing
              </LinkButton>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {purchases.map((purchase) => {
                  const invoiceStatus = invoices.find((inv) => inv.id === purchase.invoiceId)?.status;
                  return (
                    <li key={purchase.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-text">{purchase.planNameAtPurchase}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {new Date(purchase.purchasedAt).toLocaleDateString("en-IN")} ·{" "}
                          {formatMoney(purchase.finalAmountMinorUnits, purchase.currency)}
                          {purchase.discountMinorUnits > 0 ? ` (${formatMoney(purchase.discountMinorUnits, purchase.currency)} off)` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {invoiceStatus ? <Badge tone={invoiceStatus === "paid" ? "success" : "warning"}>{INVOICE_STATUS_LABELS[invoiceStatus]}</Badge> : null}
                        {purchase.invoiceId ? (
                          <LinkButton href={`/payments/${purchase.invoiceId}`} size="sm" variant="outline">
                            View invoice
                          </LinkButton>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <FileSignature aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-primary">My agreements</h2>
            <p className="mt-1 text-sm text-muted">
              {agreements.length === 0
                ? "No agreements yet — these appear here once one is prepared for you."
                : `${agreements.length} agreement${agreements.length === 1 ? "" : "s"}.`}
            </p>
            {agreements.length > 0 ? (
              <ul className="mt-4 divide-y divide-border">
                {agreements.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">{a.agreementType}</p>
                      <p className="mt-0.5 text-xs text-muted">Updated {new Date(a.updatedAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={a.signatureStatus === "signed" ? "success" : a.signatureStatus === "pending_signature" ? "warning" : "neutral"}>
                        {a.signatureStatus === "signed" ? "Signed" : a.signatureStatus === "pending_signature" ? "Awaiting signature" : "Not started"}
                      </Badge>
                      <LinkButton href={`/agreements/${a.id}`} size="sm" variant="outline">
                        View
                      </LinkButton>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Bookmark aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-primary">Saved universities &amp; courses</h2>
              <p className="mt-1 text-sm text-muted">
                {savedUniversityCount === 0 && savedCourseCount === 0
                  ? "Nothing saved yet — browse universities and courses to save some for later."
                  : `${savedUniversityCount} universit${savedUniversityCount === 1 ? "y" : "ies"}, ${savedCourseCount} course${savedCourseCount === 1 ? "" : "s"} saved.`}
              </p>
            </div>
          </div>
          <LinkButton href="/saved" size="sm" variant="outline" className="shrink-0">
            View saved
          </LinkButton>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <ClipboardList aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-primary">Applications</h2>
              <p className="mt-1 text-sm text-muted">
                {applications.length === 0
                  ? "No applications started yet — explore courses to get started."
                  : `${applications.length} application${applications.length === 1 ? "" : "s"} in progress.`}
              </p>
            </div>
          </div>
          <LinkButton href="/applications" size="sm" variant="outline" className="shrink-0">
            View applications
          </LinkButton>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <LibraryBig aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-primary">Career Explorer</h2>
              <p className="mt-1 text-sm text-muted">
                Browse a structured library of careers — what each one involves, relevant subjects and skills, and
                common education routes. Not a personalised match yet.
              </p>
            </div>
          </div>
          <LinkButton href="/careers" size="sm" variant="outline" className="shrink-0">
            Explore careers
          </LinkButton>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <UserRound aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Student Digital Profile</h2>
                <Badge tone={studentCompletion.status === "completed" ? "success" : studentCompletion.status === "in_progress" ? "info" : "neutral"}>
                  {STUDENT_PROFILE_STATUS_LABEL[studentCompletion.status] ?? studentCompletion.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {studentCompletion.status === "not_started"
                  ? "Tell us about yourself so we can personalise your career guidance later."
                  : `${studentCompletion.percent}% complete — pick up where you left off.`}
              </p>
            </div>
          </div>
          <LinkButton
            href={studentCompletion.status === "completed" ? "/profile" : "/profile/onboarding"}
            size="sm"
            className="shrink-0"
          >
            {studentCompletion.status === "not_started"
              ? "Start my profile"
              : studentCompletion.status === "completed"
                ? "View profile"
                : "Continue profile"}
          </LinkButton>
        </div>
        <ProfileProgressBar percent={studentCompletion.percent} className="mt-4" />
      </Card>

      <DemoNotice className="mt-8">
        Roadmap content and counselling activity shown here are illustrative demo data. Your account details (name,
        email, phone), Student Digital Profile, and Career Recommendations are all real and stored securely.
      </DemoNotice>
    </Section>
  );
}
