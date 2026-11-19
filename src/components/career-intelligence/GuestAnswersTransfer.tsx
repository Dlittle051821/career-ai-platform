"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { claimGuestCareerAssessment } from "@/app/(site)/career/actions";
import { clearGuestProgress, readGuestProgress } from "@/lib/career-intelligence/assessment/guest-store";
import { hasAnyAnswer } from "@/lib/career-intelligence/assessment/model";

/**
 * Rendered only for a signed-in student. If this device still holds answers
 * given before signing in, they are handed to the server once; the server
 * decides what to keep (the account wins per section; see
 * claimGuestCareerAssessment). The device copy is removed only after the
 * server confirms, so a failed transfer loses nothing.
 */
export function GuestAnswersTransfer() {
  const started = useRef(false);
  const [message, setMessage] = useState<{ tone: "ok" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const local = readGuestProgress();
    if (!local || !hasAnyAnswer(local.answers)) return;
    void claimGuestCareerAssessment(local.answers).then((result) => {
      if (result.status === "claimed") {
        clearGuestProgress();
        if (result.transferred.length > 0) {
          // reload once so this page starts from the answers now saved on the account
          window.location.reload();
        } else if (result.kept.length > 0) {
          setMessage({ tone: "info", text: "Your account already had saved answers, so those were kept." });
        }
      } else if (result.status === "error") {
        setMessage({ tone: "info", text: result.message });
      }
    });
  }, []);

  if (!message) return null;
  return (
    <div className="wrap">
      <p className="notice" role="status" style={{ marginTop: 16 }}>
        {message.tone === "ok" ? <CheckCircle2 className="icon" aria-hidden="true" /> : <Info className="icon" aria-hidden="true" />}
        <span>{message.text}</span>
      </p>
    </div>
  );
}
