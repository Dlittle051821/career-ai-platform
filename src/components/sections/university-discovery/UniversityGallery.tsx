"use client";

import { useState } from "react";
import type { UniversityPhoto } from "@/lib/supabase/education/universities";

/** Campus gallery: one large photograph and selectable thumbnails. Every photograph shows its author and licence and links to its source. */
export function UniversityGallery({ photos, universityName }: { photos: UniversityPhoto[]; universityName: string }) {
  const [active, setActive] = useState(0);
  const current = photos[Math.min(active, photos.length - 1)];
  if (!current) return null;
  return (
    <div className="ud-gal">
      <figure className="ud-gm">
        {/* eslint-disable-next-line @next/next/no-img-element -- licence-cleared campus photograph served from /public with its credit */}
        <img key={current.url} src={current.url} alt={current.alt} loading="lazy" decoding="async" />
        <figcaption>
          <b>{current.caption ?? current.alt}</b>
          <a href={current.creditSourceUrl} target="_blank" rel="noopener noreferrer">
            Photo: {current.creditAuthor} · {current.licenceName} · Wikimedia Commons
          </a>
        </figcaption>
      </figure>
      {photos.length > 1 ? (
        <ul className="ud-gt" aria-label={`Photographs of ${universityName}`}>
          {photos.map((photo, index) => (
            <li key={photo.url}>
              <button type="button" className="ud-th" aria-pressed={index === active} onClick={() => setActive(index)} aria-label={`Show photograph: ${photo.alt}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- licence-cleared campus photograph served from /public with its credit */}
                <img src={photo.url} alt="" loading="lazy" decoding="async" />
                <span>{photo.caption ?? photo.alt}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
