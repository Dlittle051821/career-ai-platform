"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/forms/Textarea";
import { addApplicationInternalNoteAction } from "@/app/admin/applications/actions";
import type { ApplicationInternalNote } from "@/lib/supabase/admin/application-notes";

const MAX_NOTE_LENGTH = 4000;

/**
 * Milestone 18 — INTERNAL staff notes. Never rendered on any student-facing
 * page — this component is only ever mounted from
 * src/app/admin/applications/[id]/page.tsx, and the data it renders comes
 * from getApplicationInternalNotes(), which no student-facing code path
 * calls (see that function's own header comment).
 */
export function AdminApplicationNotes({ applicationId, initialNotes }: { applicationId: string; initialNotes: ApplicationInternalNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd() {
    setError(null);
    const trimmed = note.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addApplicationInternalNoteAction(applicationId, (() => {
        const fd = new FormData();
        fd.set("note", trimmed);
        return fd;
      })());
      if (!result.success) {
        setError(result.error ?? "We couldn't save this note. Please try again.");
        return;
      }
      setNotes((prev) => [{ id: crypto.randomUUID(), applicationId, authorUserId: null, authorName: "You", note: trimmed, createdAt: new Date().toISOString() }, ...prev]);
      setNote("");
      formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-3">
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="space-y-2"
      >
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Add an internal note for the team — never visible to the student…"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Staff-only. Never shown to the student.</p>
          <Button type="submit" size="sm" variant="outline" disabled={isPending || !note.trim()}>
            {isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      {notes.length === 0 ? (
        <p className="text-sm text-muted">No internal notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border-t border-border pt-2 text-sm first:border-0 first:pt-0">
              <p className="text-text">{n.note}</p>
              <p className="mt-0.5 text-xs text-muted">
                {n.authorName ?? "Unknown"} — {new Date(n.createdAt).toLocaleString("en-IN")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
