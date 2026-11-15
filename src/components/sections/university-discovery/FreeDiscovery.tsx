import Link from "next/link";
import { ArrowRight, Lock, MessageCircle, Search, ShieldCheck } from "lucide-react";
import type { AdapterResult } from "@/lib/education/external-search/provider-types";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";
import type { UniversityDestination } from "@/lib/education/university-discovery/destinations";
import type { VerifiedOfferData } from "@/lib/education/university-discovery/offer";
import { DestinationBanner } from "./DestinationBanner";
import { DestinationGrid } from "./DestinationGrid";
import { OfficialResourceCard } from "./OfficialResourceCard";
import { VerifiedAccessDialog } from "./VerifiedAccessDialog";

interface FreeDiscoveryProps {
  kind: "universities" | "courses";
  destination: UniversityDestination | null;
  resources: AdapterResult[];
  accessState: UniversityAccessState;
  offer: VerifiedOfferData;
}

const COPY = {
  universities: {
    basePath: "/universities" as const,
    gridLabel: "Choose a destination to explore universities",
    bannerTitle: (name: string) => `Discover universities in ${name}.`,
    bannerBody: "Explore trusted official resources to find universities and understand your higher education options.",
    heading: "Official university discovery resources",
  },
  courses: {
    basePath: "/courses" as const,
    gridLabel: "Choose a destination to find courses",
    bannerTitle: (name: string) => `Find programmes in ${name}.`,
    bannerBody: "Official portals list current programmes, requirements and deadlines.",
    heading: "Official programme discovery resources",
  },
};

/**
 * The public discovery experience (V3 scenes A–C and H): destination cards,
 * the selected country's official portals, guidance, the Nextwise Verified
 * panel and the free discovery session. Used by /universities for visitors
 * without directory access and by /courses for every student account.
 * Renders no internal university or course record.
 */
export function FreeDiscovery({ kind, destination, resources, accessState, offer }: FreeDiscoveryProps) {
  const copy = COPY[kind];
  const returnTo = destination ? `${copy.basePath}?destination=${destination.slug}` : copy.basePath;

  if (!destination) {
    return (
      <>
        <DestinationGrid basePath={copy.basePath} ariaLabel={copy.gridLabel} />
        <p className="ud-note">
          <span><ShieldCheck aria-hidden="true" />Free to use · every link goes to a verified official source</span>
          <span>Destination photography: Pexels licence</span>
        </p>
      </>
    );
  }

  return (
    <>
      <DestinationBanner destination={destination} title={copy.bannerTitle(destination.name)} description={copy.bannerBody} backHref={copy.basePath} />

      <div className="ud-h2-row">
        <h2 className="ud-h2">{copy.heading}</h2>
        <span>External websites · free to use</span>
      </div>
      {resources.length > 0 ? (
        <ul className="ud-res-grid">
          {resources.map((result, index) => (
            <OfficialResourceCard key={result.providerId} result={result} index={index} />
          ))}
        </ul>
      ) : (
        <p className="ud-res" style={{ minHeight: 0 }}>
          No official portal is activated for {destination.name} in our system yet. We add a portal only after checking its official address.
        </p>
      )}

      <ul className="ud-tips">
        <li className="ud-tip"><i aria-hidden="true"><Search /></i><span><b>Start broad</b>Look up institutions by city, state or type on the official directories.</span></li>
        <li className="ud-tip"><i aria-hidden="true"><ShieldCheck /></i><span><b>Trust the source</b>Requirements and deadlines are always confirmed on the university&apos;s own pages.</span></li>
        <li className="ud-tip"><i aria-hidden="true"><MessageCircle /></i><span><b>Ask when unsure</b>Your first Nextwise discovery session is free.</span></li>
      </ul>

      {kind === "universities" ? (
        <div className="ud-upgrade">
          <section className="ud-teaser" aria-labelledby="ud-teaser-title">
            <span className="ud-kicker">Nextwise Verified</span>
            <h2 id="ud-teaser-title">Explore universities directly with Nextwise.</h2>
            <p>Real campus photography, what each university is known for, and a shortlist saved to your dashboard.</p>
            <VerifiedAccessDialog accessState={accessState} offer={offer} returnTo={returnTo} triggerLabel="Explore Directly with Nextwise" />
            <div className="ud-teaser-art" aria-hidden="true">
              {[0, 1, 2].map((key) => (<div key={key}><b><Lock /></b><i /><i /></div>))}
            </div>
          </section>
          <FreeSessionCard />
        </div>
      ) : (
        <div className="ud-boundary" role="note">
          <i aria-hidden="true"><Lock /></i>
          <div>
            <b>Nextwise course research is not part of any student plan</b>
            <span>Our internal programme database supports counselling and stays with authorised Nextwise admins.</span>
          </div>
        </div>
      )}
    </>
  );
}

export function FreeSessionCard() {
  return (
    <section className="ud-free" aria-labelledby="ud-free-title">
      <span className="ud-free-icon" aria-hidden="true"><MessageCircle /></span>
      <h3 id="ud-free-title">Book your free discovery session</h3>
      <p>Talk through your options with a Nextwise counsellor. No purchase needed.</p>
      <Link href="/book-counselling" className="ud-btn" data-variant="line">Book a free session<ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}
