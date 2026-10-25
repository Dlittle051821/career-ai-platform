# NW06.3 — Shortlist to Application

**Status:** Complete — confirmation only, no code change needed.

## 1. What the brief asked

That saving a university/course to a shortlist and starting a real, tracked application remain two distinct, honest actions — a shortlist item must never silently become, or auto-create, an application.

## 2. What NW06.1's audit already found (§2.8)

`education_saved_items` (the shortlist table) and `applications` (the tracked-application table) are structurally independent: no foreign key, trigger, or application-code path connects them. `listSavedItems()`/`startApplicationFromCourse()` are two entirely separate functions in two separate files (`src/lib/supabase/education/saved-items.ts` and `src/lib/supabase/education/applications.ts`); starting an application never reads or mutates a saved item, and saving an item never reads or mutates `applications`. This was true before NW06 and remains true after it — nothing in NW06.2/.6/.7's new code touches either table's relationship to the other.

## 3. Verification performed this stage

- Re-read `src/lib/supabase/education/saved-items.ts` in full (again, since the prior read was during NW06.1's audit phase): confirmed `removeSavedItem()`/`addSavedItem()`/`listSavedItems()` have zero reference to `applications`, `application_tasks`, or any application-lifecycle RPC.
- Confirmed `startApplicationFromCourse()` (`src/lib/supabase/education/applications.ts`) takes a `courseId`/`universityId` pair — resolved from a course page's own context, never from a saved-item id — and the new `application_tasks` system (NW06.6) is reached only after an application already exists (`staff_create_application_task()`'s `p_application_id` parameter), so no new coupling was introduced between shortlisting and the task system either.
- Confirmed the UI: `/saved` (the shortlist page) and `/applications`/`/studio/abroad/applications` (the application pages) remain separate routes with separate "Start application" / "View details" calls to action — a student always makes an explicit, separate decision to start an application from a course page, never from the shortlist page itself.

## 4. Conclusion

No regression, no new coupling, no code change required for this stage. The honest separation NW06.1 found is unchanged.
