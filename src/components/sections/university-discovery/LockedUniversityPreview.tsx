import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";
import type { VerifiedOfferData } from "@/lib/education/university-discovery/offer";
import { VerifiedAccessDialog } from "./VerifiedAccessDialog";

/**
 * What a visitor without directory access sees at /universities/[slug]: no
 * institution record is fetched or rendered for them. They get the upgrade
 * path and the way back to the official public resources.
 */
export function LockedUniversityPreview({ accessState, offer, returnTo }: { accessState: UniversityAccessState; offer: VerifiedOfferData; returnTo: string }) {
  return (
    <div className="ud">
      <div className="ud-wrap ud-section pt-32">
        <div className="ud-locked">
          <i aria-hidden="true"><Lock /></i>
          <h1>University profiles are part of Nextwise Verified.</h1>
          <p>You can explore universities for free through official public resources, or unlock the Nextwise directory to see profiles, campus photography and your shortlist.</p>
          <div className="ud-locked-actions">
            <VerifiedAccessDialog accessState={accessState} offer={offer} returnTo={returnTo} triggerLabel="Explore Directly with Nextwise" triggerVariant="coral" />
            <Link href="/universities" className="ud-btn" data-variant="line">Official university resources<ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
