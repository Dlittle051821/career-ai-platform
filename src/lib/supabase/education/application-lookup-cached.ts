import { cache } from "react";
import { getMyApplicationById } from "./applications";

/**
 * CC-26 — one get_my_application() call per request for /applications/[id]:
 * the segment layout (genuine 404) and the page share this cached lookup.
 */
export const getMyApplicationByIdCached = cache(getMyApplicationById);
