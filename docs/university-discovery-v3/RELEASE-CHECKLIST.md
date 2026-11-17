# Production release checklist (do not start before the Preview is approved)

1. Preview approved by the owner on desktop and mobile: free, Verified and admin views.
2. `npm run verify:visual` passes on the owner's PC.
3. Schema review of UNI_V3 0001, 0002, 0003 and their rollbacks.
4. Apply 0001–0003 to a staging database; run `docs/university-discovery-v3/qa/rest-auth-test.mjs` against it.
5. Decide the open product questions in STATUS.md.
6. Back up production data. Apply 0002, then 0001, then 0003 (or add the two portals by hand in Admin → Sources).
7. Run the direct REST checks against production with the publishable key: anonymous gets no rows from
   universities and courses.
8. Import and review Germany records; publish deliberately.
9. Merge the branch to the production branch by the normal release route (never force-push), deploy, smoke-test:
   `/`, `/universities`, `/courses`, `/saved`, `/studio`, admin grant, admin sources.
10. Tag `nextwise-baseline-university-v3-<date>` and write the release record.
11. Rollback: redeploy `acf9dff`; database rollbacks are next to each migration. Rolling back 0001 reopens public
    reads, so roll back the application first.
