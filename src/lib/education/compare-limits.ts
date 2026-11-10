/**
 * CC-23 — the course-comparison limit lives in a plain module so both the
 * client compare tray and the server compare page can import the real number.
 * (Imported from the "use client" CompareTray, the server page received a
 * client reference instead of 4, `slice(0, <reference>)` returned [], and
 * /courses/compare always said "Pick at least two courses".)
 */
export const MAX_COMPARE_COURSES = 4;
