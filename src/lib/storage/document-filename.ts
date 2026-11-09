/** One path segment, identical to the SQL capture allowlist. */
export function documentFilename(fileName: string): string {
  const name = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^[^a-zA-Z0-9_]+/, "").slice(0, 200);
  return name || "document.pdf";
}
