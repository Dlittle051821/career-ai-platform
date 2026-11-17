import Link from "next/link";
import { ArrowRight, Heart, LockOpen } from "lucide-react";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";

/**
 * University Discovery V3 — heading of the unlocked directory. The status line states the real reason the
 * directory is open (staff, a paid plan, or a grant by the Nextwise team); it is never a decorative badge.
 */
export function DirectoryHero({ access, canSave, savedCount }: { access: UniversityAccessState; canSave: boolean; savedCount: number }) {
  return (
    <div className="ud-wrap ud-dir-hero">
      <div className="ud-dir-top">
        <div>
          <span className="ud-unlocked">
            <i aria-hidden="true"><LockOpen /></i>
            <span>
              <b>Directory unlocked</b>
              {access === "admin" ? "Staff access" : access === "verified_by_grant" ? "Nextwise Verified · granted by the Nextwise team" : "Nextwise Verified · active"}
            </span>
          </span>
          <h1>Your university discovery starts here.</h1>
          <p>Explore universities across your preferred destinations, see what each is known for, and build your personal shortlist.</p>
        </div>
        {canSave ? (
          <Link href="/saved" className="ud-svp" aria-label={`${savedCount} saved universities. Open your saved list.`}>
            <i aria-hidden="true"><Heart /></i>
            <span><b>{savedCount} saved</b>Saved universities</span>
            <em>Open <ArrowRight aria-hidden="true" /></em>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
