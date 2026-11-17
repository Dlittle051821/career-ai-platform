import type { Metadata } from "next";
import { Award, Calculator, ClipboardCheck, FileText, GraduationCap, ListChecks, PenLine, Telescope, type LucideIcon } from "lucide-react";
import { UPCOMING_TOOLS, UPCOMING_TOOL_STATUS_LABEL, type UpcomingToolIcon } from "@/config/upcoming-tools";
import { publicPageMetadata } from "@/config/seo";
import "@/styles/career-explorer.css";

export const metadata: Metadata = publicPageMetadata(
  "/tools",
  "Free Tools, Coming Soon",
  "Nextwise is preparing free, practical tools for students planning their studies and careers. See what is planned.",
);

const ICONS: Record<UpcomingToolIcon, LucideIcon> = {
  cv: FileText,
  calculator: Calculator,
  checklist: ListChecks,
  profile: GraduationCap,
  letter: PenLine,
  scholarship: Award,
  eligibility: ClipboardCheck,
  reality: Telescope,
};

/**
 * Free Tools, Coming Soon — the catalogue of the eight planned tools
 * (src/config/upcoming-tools.ts). Each card is information only: an
 * <article> with a name, a planned purpose and a status. There is no link,
 * button, handler, hover state or pointer cursor on a card, and no tool has
 * a route of its own.
 */
export default function FreeToolsPage() {
  return (
    <div className="ce">
      <section className="ce-section" aria-labelledby="tools-title">
        <div className="ce-wrap">
          <p className="ce-hero-top" style={{ marginTop: 16 }}>
            <span className="ce-eyebrow">Free Tools</span>
          </p>
          <div className="ce-cat-head">
            <div>
              <h1 id="tools-title">Free Tools, Coming Soon</h1>
              <p className="ce-cat-sub" style={{ maxWidth: "44em" }}>
                Nextwise is preparing practical resources for students planning what to study and where. These eight tools are planned. None is
                available yet, and we will add each one here when it is ready.
              </p>
            </div>
          </div>
          <ul className="ce-tools">
            {UPCOMING_TOOLS.map((tool) => {
              const Icon = ICONS[tool.icon];
              return (
                <li key={tool.id}>
                  <article className="ce-tool" aria-labelledby={`tool-${tool.id}`}>
                    <span className="ce-tool-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <h2 id={`tool-${tool.id}`}>{tool.name}</h2>
                    <p>{tool.description}</p>
                    <span className="ce-tool-status">{UPCOMING_TOOL_STATUS_LABEL}</span>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
