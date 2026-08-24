"use client";

import { useId, useState } from "react";
import { Globe } from "lucide-react";
import { LANGUAGES } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Small, honest language switcher. English is fully functional; selecting
 * Odia shows an inline "coming soon" notice instead of silently doing
 * nothing or pretending a translation exists.
 */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<"en" | "or">("en");
  const noticeId = useId();
  const showNotice = selected === "or";

  return (
    <div className={cn("relative shrink-0", compact ? "w-full" : undefined)}>
      <div
        role="group"
        aria-label="Choose a language"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface p-1 text-sm",
          compact ? "w-full justify-center" : undefined
        )}
      >
        <Globe aria-hidden="true" className="ml-1.5 h-4 w-4 text-muted" />
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            aria-pressed={selected === lang.code}
            aria-describedby={lang.code === "or" ? noticeId : undefined}
            onClick={() => setSelected(lang.code)}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium transition-colors",
              selected === lang.code ? "bg-primary text-on-primary" : "text-text-soft hover:bg-surface-alt"
            )}
          >
            {lang.nativeLabel}
          </button>
        ))}
      </div>
      {showNotice ? (
        <p
          id={noticeId}
          role="status"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-[var(--radius-control)] border border-border bg-surface p-3 text-xs text-muted shadow-lifted"
        >
          ଓଡ଼ିଆ experience coming soon. The site currently works fully in English.
        </p>
      ) : null}
    </div>
  );
}
