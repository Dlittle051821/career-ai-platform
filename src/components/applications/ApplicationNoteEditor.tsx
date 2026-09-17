"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { updateApplicationNoteAction } from "@/app/(site)/applications/actions";

const MAX_NOTE_LENGTH = 2000;

/**
 * Milestone 16 — the student's own editable note on their application.
 * Entirely separate from anything admin/counsellor-authored (this
 * component, and the RPC behind it, never reads or writes
 * `internal_notes`). Length-limited client-side to match
 * applications_student_note_length_check (server-enforced regardless — this
 * is just a helpful, immediate counter, not the real guard).
 */
export function ApplicationNoteEditor({ applicationId, initialNote }: { applicationId: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [savedNote, setSavedNote] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDirty = note !== savedNote;

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateApplicationNoteAction(applicationId, note);
      if (!result.success) {
        setError(result.error ?? "Your note could not be saved. Please try again.");
        return;
      }
      setSavedNote(note);
      setSaved(true);
    });
  }

  return (
    <FormField
      id="student-note"
      label="Your note"
      hint="Private to you and visible to your NextWise team — never shared with the university."
      error={error ?? undefined}
    >
      <Textarea
        id="student-note"
        value={note}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="Add a note for yourself or your counsellor about this application…"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {note.length}/{MAX_NOTE_LENGTH}
          {saved && !isDirty ? " — Saved" : ""}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isPending || !isDirty}>
          {isPending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </FormField>
  );
}
