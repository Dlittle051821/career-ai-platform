import { CloudOff, SearchX } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

interface DetailRecordNoticeProps {
  /** "not_found" — no such published record (rendered from a route's not-found.tsx, HTTP 404). "unavailable" — the lookup itself failed. */
  kind: "not_found" | "unavailable";
  /** What the record is, in plain words: "career", "university", "course". */
  noun: string;
  browseHref: string;
  browseLabel: string;
}

/**
 * CC-24 — the one notice a public detail route shows when it has nothing to
 * render. Same card the routes rendered before CC-24 (so the look does not
 * change); what changed is that a missing record now reaches it through
 * notFound() with a genuine 404 status, and a failed lookup says so instead
 * of claiming the record does not exist.
 */
export function DetailRecordNotice({ kind, noun, browseHref, browseLabel }: DetailRecordNoticeProps) {
  const notFound = kind === "not_found";
  const Icon = notFound ? SearchX : CloudOff;
  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <Card className="flex flex-col items-center gap-3 py-14 text-center">
        <Icon aria-hidden="true" className="h-10 w-10 text-muted" />
        <h1 className="text-lg font-semibold text-primary">
          {notFound ? `We couldn't find that ${noun}` : `This ${noun} can't be shown right now`}
        </h1>
        <p className="max-w-sm text-sm text-muted">
          {notFound
            ? "It may have been renamed, isn't published yet, or the link may be out of date."
            : "We couldn't load it just now. Please try again in a moment."}
        </p>
        <LinkButton href={browseHref} size="sm" className="mt-2">
          {browseLabel}
        </LinkButton>
      </Card>
    </Section>
  );
}
