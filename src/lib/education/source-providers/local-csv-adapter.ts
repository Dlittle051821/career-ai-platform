import { parseCsv } from "../csv";
import type { EducationSourceProviderAdapter } from "./types";

/**
 * The only source-provider adapter this platform implements: an
 * admin-uploaded local CSV file. See `./types.ts` for why this interface
 * exists even with a single implementation, and
 * `src/lib/supabase/admin/education-imports.ts`'s `validateImportBatch`
 * for the (sole) caller — it calls `localCsvAdapter.fetchRawRecords(...)`,
 * never `parseCsv` directly, so this is a real, wired-in indirection, not
 * decorative unused code.
 */
export const localCsvAdapter: EducationSourceProviderAdapter = {
  id: "local_csv",
  label: "Local CSV upload",
  fetchRawRecords(csvText: string) {
    return parseCsv(csvText);
  },
};
