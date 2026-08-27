import { describe, expect, it } from "vitest";
import { contentPreview, isValidContentSlug, normalizeContentBody, splitContentParagraphs } from "./content";

describe("normalizeContentBody", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeContentBody("  hello  ")).toBe("hello");
  });

  it("normalizes CRLF to LF", () => {
    expect(normalizeContentBody("line one\r\nline two")).toBe("line one\nline two");
  });

  it("caps extremely long input rather than storing unbounded text", () => {
    const huge = "a".repeat(50_000);
    expect(normalizeContentBody(huge).length).toBeLessThanOrEqual(20_000);
  });
});

describe("splitContentParagraphs", () => {
  it("returns an empty array for empty input", () => {
    expect(splitContentParagraphs("")).toEqual([]);
  });

  it("splits on blank lines into paragraphs, preserving single line breaks within a paragraph", () => {
    const result = splitContentParagraphs("Para one line one\nPara one line two\n\nPara two");
    expect(result).toEqual([["Para one line one", "Para one line two"], ["Para two"]]);
  });

  it("never produces an HTML-like structure — every element is a plain string", () => {
    const result = splitContentParagraphs("<script>alert(1)</script>\n\nnext paragraph");
    for (const paragraph of result) {
      for (const line of paragraph) {
        expect(typeof line).toBe("string");
      }
    }
    // The literal tag text survives as plain text (React will escape it on
    // render) — this function's job is only to split, never to interpret.
    expect(result[0][0]).toContain("<script>");
  });
});

describe("contentPreview", () => {
  it("collapses whitespace/newlines into a single line", () => {
    expect(contentPreview("line one\n\nline two")).toBe("line one line two");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "word ".repeat(100);
    const preview = contentPreview(long, 50);
    expect(preview.length).toBeLessThanOrEqual(50);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("does not truncate text shorter than the limit", () => {
    expect(contentPreview("short text", 140)).toBe("short text");
  });
});

describe("isValidContentSlug", () => {
  it("accepts a well-formed slug", () => {
    expect(isValidContentSlug("how-do-i-apply")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidContentSlug("")).toBe(false);
  });

  it("rejects uppercase and spaces", () => {
    expect(isValidContentSlug("How Do I")).toBe(false);
  });

  it("rejects leading/trailing hyphens and double hyphens", () => {
    expect(isValidContentSlug("-leading")).toBe(false);
    expect(isValidContentSlug("trailing-")).toBe(false);
    expect(isValidContentSlug("double--hyphen")).toBe(false);
  });
});
