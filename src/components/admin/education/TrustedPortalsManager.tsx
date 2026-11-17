"use client";

import { useActionState } from "react";
import { ExternalLink } from "lucide-react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE } from "@/lib/admin/form-state";
import {
  createTrustedPortalAction,
  setTrustedPortalActiveAction,
  verifyTrustedPortalAction,
} from "@/app/admin/education/sources/actions";

export interface TrustedPortalRow {
  id: string;
  displayName: string;
  countryCode: string | null;
  officialDomain: string;
  baseUrl: string;
  active: boolean;
  lastVerifiedAt: string | null;
}

/**
 * University Discovery V3 — the trusted official portals students are sent to
 * (Hochschulkompass, Study in Germany, DAAD ...). Students only ever see a
 * portal that is in this registry AND switched on. Checking the address and
 * switching a portal on are two separate, audited steps.
 */
export function TrustedPortalsManager({ portals, canWrite }: { portals: TrustedPortalRow[]; canWrite: boolean }) {
  return (
    <div>
      {portals.length === 0 ? (
        <p className="text-sm text-muted">No trusted portals are registered yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {portals.map((portal) => (
            <li key={portal.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-portal={portal.displayName}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {portal.displayName}
                  <span className="ml-2 text-xs font-medium text-muted">{portal.countryCode ?? "All countries"}</span>
                </p>
                <a href={portal.baseUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-secondary underline">
                  {portal.baseUrl}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
                <p className="mt-1 text-xs text-muted">
                  Official domain {portal.officialDomain} · {portal.lastVerifiedAt ? `address last checked ${portal.lastVerifiedAt}` : "address not checked yet"} ·{" "}
                  <strong className={portal.active ? "text-emerald-700" : "text-amber-700"}>{portal.active ? "Shown to students" : "Not shown to students"}</strong>
                </p>
              </div>
              {canWrite ? <PortalRowActions portal={portal} /> : null}
            </li>
          ))}
        </ul>
      )}
      {canWrite ? <AddPortalForm /> : null}
    </div>
  );
}

function PortalRowActions({ portal }: { portal: TrustedPortalRow }) {
  const [verifyState, verifyAction] = useActionState(verifyTrustedPortalAction, INITIAL_ACTION_STATE);
  const [activeState, activeAction] = useActionState(setTrustedPortalActiveAction, INITIAL_ACTION_STATE);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <form action={verifyAction}>
          <input type="hidden" name="id" value={portal.id} />
          <SubmitButton>I checked this address today</SubmitButton>
        </form>
        <form action={activeAction}>
          <input type="hidden" name="id" value={portal.id} />
          <input type="hidden" name="active" value={portal.active ? "false" : "true"} />
          <SubmitButton>{portal.active ? "Hide from students" : "Show to students"}</SubmitButton>
        </form>
      </div>
      <FormError error={verifyState.error ?? activeState.error} />
    </div>
  );
}

const INPUT = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-primary";

function AddPortalForm() {
  const [state, formAction] = useActionState(createTrustedPortalAction, INITIAL_ACTION_STATE);
  return (
    <details className="mt-4 rounded-xl border border-line p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">Add an official portal</summary>
      <p className="mt-2 text-xs text-muted">
        A new portal is saved as not shown to students. Check the address on the operator&apos;s own site first, then switch it on.
      </p>
      <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted">Name<input name="displayName" required maxLength={120} className={INPUT} placeholder="Hochschulkompass" /></label>
        <label className="text-xs font-medium text-muted">Short id (lowercase, hyphens)<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} className={INPUT} placeholder="hochschulkompass" /></label>
        <label className="text-xs font-medium text-muted">Country code (2 letters)<input name="countryCode" required pattern="[A-Za-z]{2}" maxLength={2} className={INPUT} placeholder="DE" /></label>
        <label className="text-xs font-medium text-muted">Official domain<input name="officialDomain" required maxLength={120} className={INPUT} placeholder="hochschulkompass.de" /></label>
        <label className="text-xs font-medium text-muted sm:col-span-2">Address (https, on the official domain)<input name="baseUrl" type="url" required maxLength={300} className={INPUT} placeholder="https://www.hochschulkompass.de/" /></label>
        <label className="text-xs font-medium text-muted sm:col-span-2">Description shown to students<input name="description" maxLength={300} className={INPUT} /></label>
        <input type="hidden" name="providerType" value="course_search" />
        <input type="hidden" name="strategy" value="official_landing_page" />
        <input type="hidden" name="language" value="en" />
        <input type="hidden" name="supportedDegreeLevels" value="bachelors" />
        <input type="hidden" name="supportedDegreeLevels" value="masters" />
        <input type="hidden" name="supportedDegreeLevels" value="doctorate" />
        <div className="sm:col-span-2">
          <FormError error={state.error} />
          <SubmitButton>Save portal (not shown yet)</SubmitButton>
        </div>
      </form>
    </details>
  );
}
