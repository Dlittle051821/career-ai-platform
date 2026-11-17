"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { AUTH_LINKS, SAVED_CAREERS_EVENT } from "@/config/site";
import { toggleSaveCareerAction } from "@/app/(site)/careers/actions";

type Notice = "sign_in" | "unavailable" | null;
const SYNC_EVENT = "nw:career-save-state";

/**
 * Save / remove a career. Free for every signed-in student. A signed-out
 * visitor is asked to log in or sign up — never to buy a plan. The server
 * decides who is signed in; this button only reflects what it answers.
 */
export function SaveCareerButton({
  careerId,
  slug,
  title,
  initialSaved,
  inline = false,
}: {
  careerId: string;
  slug: string;
  title: string;
  initialSaved: boolean;
  inline?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const next = `/careers/${slug}`;

  // keep every save button for the same career on the page in step
  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ careerId?: string; saved?: boolean }>).detail;
      if (detail?.careerId === careerId && typeof detail.saved === "boolean") setSaved(detail.saved);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [careerId]);

  const onClick = () => {
    const want = !saved;
    setSaved(want); // optimistic; rolled back below if the server says no
    setNotice(null);
    startTransition(async () => {
      const result = await toggleSaveCareerAction(careerId, want);
      if (result.status === "saved" || result.status === "removed") {
        setSaved(result.status === "saved");
        window.dispatchEvent(new CustomEvent(SAVED_CAREERS_EVENT, { detail: { total: result.total } }));
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { careerId, saved: result.status === "saved" } }));
        return;
      }
      setSaved(!want);
      setNotice(result.status === "sign_in_required" ? "sign_in" : "unavailable");
      window.setTimeout(() => setNotice(null), 8000);
    });
  };

  return (
    <>
      <button
        type="button"
        className="ce-save"
        data-inline={inline ? "" : undefined}
        aria-pressed={saved}
        aria-label={inline ? undefined : saved ? `Remove ${title} from saved careers` : `Save ${title}`}
        aria-busy={pending}
        onClick={onClick}
      >
        <Bookmark aria-hidden="true" />
        {inline ? (saved ? "Saved" : "Save career") : null}
      </button>
      {notice ? (
        <div className="ce-toast" role="status">
          {notice === "sign_in" ? (
            <>
              Saving is free. Log in or create an account to keep this career.
              <Link href={`${AUTH_LINKS.login.href}?next=${encodeURIComponent(next)}`}>{AUTH_LINKS.login.label}</Link>
              <Link href={AUTH_LINKS.signup.href}>{AUTH_LINKS.signup.label}</Link>
            </>
          ) : (
            "Saving careers isn't available right now. Please try again later."
          )}
        </div>
      ) : null}
    </>
  );
}
