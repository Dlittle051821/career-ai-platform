import type { Metadata } from "next";
import Link from "next/link";
import { CareerPhoto } from "@/components/career-explorer/CareerPhoto";
import { listPhotoCredits } from "@/lib/career-explorer/photos";
import "@/styles/career-explorer.css";

export const metadata: Metadata = {
  title: "Career Explorer photo credits",
  description: "Sources, creators and licences for the photographs used in the Nextwise Career Explorer.",
  alternates: { canonical: "/careers/photo-credits" },
  robots: { index: false, follow: true },
};

/** Attribution for every Career Explorer photograph (Wikimedia Commons; see docs/career-explorer/image-provenance.json). */
export default function CareerPhotoCreditsPage() {
  const credits = listPhotoCredits();
  return (
    <div className="ce">
      <section className="ce-section">
        <div className="ce-wrap">
          <nav aria-label="Breadcrumb">
            <ol className="ce-crumbs">
              <li>
                <Link href="/careers">Career Explorer</Link>
              </li>
              <li aria-current="page">Photo credits</li>
            </ol>
          </nav>
          <div className="ce-cat-head">
            <div>
              <h1>Photo credits</h1>
              <p className="ce-cat-sub">
                Career Explorer photographs come from Wikimedia Commons and are used under the licence shown for each. Photographs are cropped and
                resized; no other changes are made.
              </p>
            </div>
          </div>
          <ul className="ce-credits">
            {credits.map(({ key, photo }) => (
              <li key={key}>
                <CareerPhoto photo={photo} sizes="96px" decorative />
                <div>
                  <p>{photo.attribution || photo.alt}</p>
                  <p>
                    {photo.sourceUrl ? (
                      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Source
                      </a>
                    ) : null}
                    {photo.licence ? (
                      <>
                        {" · "}
                        {photo.licenceUrl ? (
                          <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer">
                            {photo.licence}
                          </a>
                        ) : (
                          photo.licence
                        )}
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
