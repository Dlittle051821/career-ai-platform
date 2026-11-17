"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleSaveUniversityAction } from "@/app/(site)/universities/[slug]/actions";

interface SaveState {
  saved: boolean;
  pending: boolean;
  error: string | null;
  name: string;
  toggle: () => void;
}

const SaveContext = createContext<SaveState | null>(null);

interface SaveUniversityProviderProps {
  universityId: string;
  slug: string;
  name: string;
  initialSaved: boolean;
  children: React.ReactNode;
}

/**
 * Shares one saved/unsaved state between every save control for the same
 * university (the heart on the photo and the Save button, or the hero button
 * and the sticky bar). The state shown is the server's answer: the control
 * flips optimistically, then settles on what the server action returned, and
 * rolls back with a message if the save failed.
 */
export function SaveUniversityProvider({ universityId, slug, name, initialSaved, children }: SaveUniversityProviderProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = useCallback(() => {
    if (pending) return;
    const next = !saved;
    setSaved(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await toggleSaveUniversityAction(universityId, slug, next);
        setSaved(result.saved);
        setError(result.error);
      } catch {
        setSaved(!next);
        setError("We couldn't reach Nextwise. Check your connection and try again.");
      }
    });
  }, [pending, saved, slug, universityId]);

  const value = useMemo(() => ({ saved, pending, error, name, toggle }), [saved, pending, error, name, toggle]);
  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>;
}

function useSave(): SaveState {
  const value = useContext(SaveContext);
  if (!value) throw new Error("Save controls must be rendered inside SaveUniversityProvider");
  return value;
}

export function SaveHeart() {
  const { saved, pending, name, toggle } = useSave();
  return (
    <button type="button" className="ud-heart" aria-pressed={saved} disabled={pending} onClick={toggle} aria-label={saved ? `Remove ${name} from saved universities` : `Save ${name}`}>
      <Heart aria-hidden="true" />
    </button>
  );
}

export function SaveButton({ tone, removeLabel = false }: { tone?: "glass" | "bar"; removeLabel?: boolean }) {
  const { saved, pending, name, toggle } = useSave();
  return (
    <button type="button" className="ud-save" data-tone={tone} aria-pressed={saved} disabled={pending} onClick={toggle} aria-label={saved ? `Remove ${name} from saved universities` : `Save ${name}`}>
      <Heart aria-hidden="true" />
      {saved ? (removeLabel ? "Remove" : "Saved") : "Save"}
    </button>
  );
}

/** Announces a failed save to assistive technology and shows it next to the control. */
export function SaveError() {
  const { error } = useSave();
  return (
    <span aria-live="polite">
      {error ? <span className="ud-save-err" role="alert">{error}</span> : null}
    </span>
  );
}
