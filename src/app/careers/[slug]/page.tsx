import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LinkButton } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { CareerCard } from "@/components/sections/careers/CareerCard";
import { getCareerBySlug, getRelatedCareers } from "@/lib/supabase/careers";
import { subjectLabel, interestLabel, skillLabel, educationLevelLabel, fieldLabel, SKILL_LEVEL_LABELS, RELEVANCE_LABELS } from "@/lib/careers/labels";
import { deriveCareerCharacteristics } from "@/lib/careers/characteristics";

interface CareerDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CareerDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const career = await getCareerBySlug(slug);
  if (!career) return { title: "Career not found" };
  return { title: career.title, description: career.summary };
}

/**
 * Career detail route (Milestone 4 §24), e.g. `/careers/ev-systems-engineer`.
 * Public, like `/careers` itself. Shows exactly the sections listed in the
 * spec — title, family, summary, what-you-do, environment, subjects,
 * interests, skills, education routes, industries, characteristics, related
 * careers — and nothing that looks like a personalised match. The "Add to
 * careers I'm interested in" CTA from §24 is deferred: it would need a new
 * student-owned table + RLS policy, which is more schema than "browse a
 * detail page" needs and edges toward the personalisation Milestone 5 owns
 * — the spec explicitly allows deferring it if it can't be done cleanly.
 */
export default async function CareerDetailPage({ params }: CareerDetailPageProps) {
  const { slug } = await params;
  const career = await getCareerBySlug(slug);

  if (!career) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <SearchX aria-hidden="true" className="h-10 w-10 text-muted" />
          <h1 className="text-lg font-semibold text-primary">We couldn&apos;t find that career</h1>
          <p className="max-w-sm text-sm text-muted">
            It may have been renamed, isn&apos;t published yet, or the link may be out of date.
          </p>
          <LinkButton href="/careers" size="sm" className="mt-2">
            Browse the Career Explorer
          </LinkButton>
        </Card>
      </Section>
    );
  }

  const [related, characteristics] = await Promise.all([
    getRelatedCareers(career.id),
    Promise.resolve(deriveCareerCharacteristics(career.scores)),
  ]);

  const coreSubjects = career.subjects.filter((s) => s.importance >= 4);
  const otherSubjects = career.subjects.filter((s) => s.importance < 4);
  const coreInterests = career.interests.filter((i) => i.importance >= 4);
  const otherInterests = career.interests.filter((i) => i.importance < 4);

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Career Explorer", href: "/careers" }, { label: career.title }]} />

      <div className="mt-6 mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{career.familyName}</Badge>
          {career.isFeatured ? <Badge tone="accent">Featured</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-primary balance sm:text-4xl">{career.title}</h1>
        <p className="mt-3 max-w-2xl text-base text-muted">{career.summary}</p>
        {career.aliases.length > 0 ? (
          <p className="mt-2 text-sm text-muted">
            Also known as: <span className="text-text-soft">{career.aliases.join(", ")}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-primary">What you do</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{career.whatYouDo}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-primary">Typical work environment</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{career.typicalEnvironment}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Typical entry point</p>
            <p className="mt-1 text-sm text-text-soft">{career.typicalEntryLevel}</p>
          </Card>

          {career.subjects.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Relevant subjects</h2>
              <ChipGroup label="Core" items={coreSubjects.map((s) => subjectLabel(s.subjectKey))} tone="accent" />
              <ChipGroup label="Also relevant" items={otherSubjects.map((s) => subjectLabel(s.subjectKey))} tone="neutral" />
            </Card>
          ) : null}

          {career.interests.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Relevant interests</h2>
              <ChipGroup label="Core" items={coreInterests.map((i) => interestLabel(i.interestKey))} tone="accent" />
              <ChipGroup label="Also relevant" items={otherInterests.map((i) => interestLabel(i.interestKey))} tone="neutral" />
            </Card>
          ) : null}

          {career.skills.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Useful skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {career.skills.map((s) => (
                  <Badge key={s.skillKey} tone="neutral">
                    {skillLabel(s.skillKey)}
                    <span className="text-muted">· {SKILL_LEVEL_LABELS[s.recommendedLevel] ?? s.recommendedLevel}</span>
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                These are useful, relevant skills to build over time — not a checklist you need to already have.
              </p>
            </Card>
          ) : null}

          {career.educationRoutes.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Common education routes</h2>
              <div className="mt-3 space-y-2">
                {career.educationRoutes.map((route, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
                    <span className="font-medium text-text">{educationLevelLabel(route.educationLevel)}</span>
                    <span className="text-muted">—</span>
                    <span className="text-text-soft">{fieldLabel(route.fieldKey)}</span>
                    <Badge tone={route.relevance === "primary" ? "success" : route.relevance === "common" ? "info" : "neutral"} className="ml-auto text-[11px]">
                      {RELEVANCE_LABELS[route.relevance] ?? route.relevance}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                These are common routes in, not the only path — and not a university or course recommendation.
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {characteristics.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Career characteristics</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {characteristics.map((label) => (
                  <Badge key={label} tone="accent">
                    {label}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                General tendencies for this career, not a guarantee — actual roles vary by employer and location.
              </p>
            </Card>
          ) : null}

          {career.industries.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Industries</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {career.industries.map((ind) => (
                  <Badge key={ind.id} tone="neutral">
                    {ind.name}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}

          {career.tags.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Tags</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {career.tags.map((tag) => (
                  <Badge key={tag.id} tone="neutral">
                    {tag.label}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-primary">Related careers</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <CareerCard key={r.id} career={r} />
            ))}
          </div>
        </div>
      ) : null}

      <DemoNotice className="mt-8">
        This page describes the career itself — it isn&apos;t a personalised match for you. Career recommendations
        based on your Student Digital Profile arrive in a later milestone.
      </DemoNotice>

      <div className="mt-6">
        <Link href="/careers" className="text-sm font-semibold text-secondary-dark hover:text-primary">
          ← Back to Career Explorer
        </Link>
      </div>
    </Section>
  );
}

function ChipGroup({ label, items, tone }: { label: string; items: string[]; tone: "accent" | "neutral" }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} tone={tone}>
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
