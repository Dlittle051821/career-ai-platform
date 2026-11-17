import Link from "next/link";
import { getCareerCardExtras, listSavedCareerIds } from "@/lib/supabase/career-explorer";
import { getCareersByIds } from "@/lib/supabase/careers";
import { CareerExplorerCard } from "./CareerExplorerCard";
import { CompareTray } from "./CompareTray";
import "@/styles/career-explorer.css";

/**
 * Career Explorer V5 — the signed-in student's saved careers, as one
 * self-contained block for /saved. It reads only career_saved_items and
 * renders nothing when no career is saved, so the saved universities and
 * courses on the same page are not affected in any way.
 */
export async function SavedCareersSection() {
  const ids = await listSavedCareerIds();
  if (ids.length === 0) return null;
  const careers = await getCareersByIds(ids);
  if (careers.length === 0) return null;
  const extras = await getCareerCardExtras(careers.map((c) => c.id));
  return (
    <section className="ce ce-saved" aria-labelledby="saved-careers-title">
      <h2 id="saved-careers-title">Saved careers</h2>
      <p className="ce-note" style={{ marginTop: 6 }}>
        Careers you&rsquo;ve bookmarked in the <Link href="/careers" className="ce-textlink">Career Explorer</Link>. Saving is free.
      </p>
      <ul className="ce-grid">
        {careers.map((career) => (
          <li key={career.id}>
            <CareerExplorerCard career={career} extras={extras.get(career.id)} saved />
          </li>
        ))}
      </ul>
      <CompareTray />
    </section>
  );
}

/** How many careers the signed-in student has saved (0 when signed out) — lets /saved decide its empty state. */
export async function countSavedCareers(): Promise<number> {
  return (await listSavedCareerIds()).length;
}
