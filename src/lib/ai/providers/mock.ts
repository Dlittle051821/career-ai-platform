import type { AiProvider, AiRawResult, AiStructuredRequest } from "../types";

/**
 * NW09 — deterministic mock provider. Free, offline, no network. The
 * "analyst" is a pure function supplied by the task (for Career
 * Intelligence: src/lib/career-intelligence/mock-analyst.ts) that builds a
 * schema-valid answer from the structured payload — same input, same
 * output, every time. Token usage is a rough chars/4 estimate, labelled as
 * an estimate wherever it is shown.
 */
export type MockAnalyst = (payload: unknown, request: AiStructuredRequest) => unknown;

export interface MockBehaviour {
  /** Force a specific failure, for tests of the failure paths. */
  failWith?: "refused" | "incomplete" | "invalid_json" | "wrong_shape";
}

export function createMockProvider(analyst: MockAnalyst, behaviour: MockBehaviour = {}): AiProvider {
  return {
    name: "mock",
    model: "mock-deterministic-v1",
    async generate(request): Promise<AiRawResult> {
      const usage = { inputTokens: Math.ceil((request.instructions.length + request.input.length) / 4), outputTokens: 0 };
      const model = "mock-deterministic-v1";
      if (behaviour.failWith === "refused") return { status: "refused", reason: "Mock refusal.", usage, model };
      if (behaviour.failWith === "incomplete") return { status: "incomplete", reason: "max_output_tokens", usage, model };
      const text = behaviour.failWith === "invalid_json" ? "{not json" : behaviour.failWith === "wrong_shape" ? JSON.stringify({ hello: "world" }) : JSON.stringify(analyst(request.payload, request));
      return { status: "ok", text, usage: { ...usage, outputTokens: Math.ceil(text.length / 4) }, model };
    },
  };
}
