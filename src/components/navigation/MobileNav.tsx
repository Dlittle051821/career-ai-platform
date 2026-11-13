"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_LINKS, DISCOVERY_SESSION_CTA } from "@/config/site";
import { useAuthProfile } from "@/lib/supabase/use-auth-profile";
import { logout } from "@/lib/supabase/actions";
import { MobileNavGroups } from "./MobileNavGroups";
import { WorkspaceEntryLink } from "./WorkspaceEntryLink";

/**
 * The global header's phone / portrait-tablet menu (CIUX-01B: one menu for
 * the homepage and every page — the homepage's approved menu-button-and-
 * panel pattern, which replaces the CIUX-01 full-height sheet on other
 * pages). The panel holds the free session action, the grouped navigation
 * (MobileNavGroups) and the account actions.
 *
 * Behaviour: the round button toggles the panel (aria-expanded,
 * aria-controls); opening moves focus to the first link; Escape closes and
 * returns focus to the button; a press outside closes; navigating closes.
 * On the homepage (`rootId`) it also marks the story root while open, so the
 * chapter controller pauses (lib/home/v54/chapters.ts).
 */
export function MobileNav({ rootId }: { rootId?: string }) {
  const { user, ready } = useAuthProfile();
  const signedIn = ready && Boolean(user);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const panelId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const root = rootId ? document.getElementById(rootId) : null;
    if (open) root?.setAttribute("data-v54-menu-open", "");
    else root?.removeAttribute("data-v54-menu-open");
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btn.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      root?.removeAttribute("data-v54-menu-open");
    };
  }, [open, rootId]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="nwh-menu-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true" />
      </button>
      <div ref={panel} id={panelId} className="nwh-menu" data-v54-free="" hidden={!open}>
        <nav aria-label="Main" className="nwh-menu-nav">
          <Link href={DISCOVERY_SESSION_CTA.href} className="nwh-menu-book" onClick={close}>
            {DISCOVERY_SESSION_CTA.label}
          </Link>
          <MobileNavGroups onNavigate={close} />
        </nav>
        <div className="nwh-menu-actions">
          {signedIn ? (
            <>
              <WorkspaceEntryLink bare forceLabel className="nwh-signup" />
              <form action={logout}>
                <button type="submit" className="nwh-login">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href={AUTH_LINKS.login.href} className="nwh-login" onClick={close}>
                {AUTH_LINKS.login.label}
              </Link>
              <Link href={AUTH_LINKS.signup.href} className="nwh-signup" onClick={close}>
                {AUTH_LINKS.signup.label}
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
