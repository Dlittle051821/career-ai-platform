import { z } from "zod";

/**
 * NW09 — turn a Zod schema into the JSON Schema both providers accept for
 * structured output. OpenAI's strict mode requires every object to list all
 * of its properties as required and to forbid additional properties; length
 * and count limits are removed from what the PROVIDER sees (support varies)
 * but are still enforced by the Zod schema on the way back in.
 */
const DROP = new Set(["$schema", "minLength", "maxLength", "minItems", "maxItems", "pattern", "format", "default", "examples", "title"]);

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (DROP.has(key)) continue;
    out[key] = strictify(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties as object);
    out.additionalProperties = false;
  }
  return out;
}

export function toProviderJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return strictify(z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "throw" })) as Record<string, unknown>;
}
