import { describe, expect, it } from "vitest";

import {
  describeCredentialError,
  isSelectableOpenAIModel,
  sortModels,
} from "@/lib/llm/models";
import type { LlmModel } from "@/lib/llm/types";

/** SDK-style error: HTTP status plus an optional type/code and message. */
function apiError(
  status: number,
  extra: { type?: string; code?: string; message?: string } = {},
): unknown {
  return Object.assign(new Error(extra.message ?? ""), {
    status,
    type: extra.type,
    code: extra.code,
  });
}

describe("isSelectableOpenAIModel", () => {
  it("keeps conversational models", () => {
    for (const id of [
      "gpt-5",
      "gpt-5-nano",
      "gpt-4o",
      "o3-mini",
      "chatgpt-4o-latest",
    ]) {
      expect(isSelectableOpenAIModel(id), id).toBe(true);
    }
  });

  it("drops what does not converse", () => {
    const dropped = [
      "text-embedding-3-large",
      "omni-moderation-latest",
      "whisper-1",
      "tts-1-hd",
      "dall-e-3",
      "gpt-image-1",
      "gpt-4o-realtime-preview",
      "gpt-4o-audio-preview",
      "gpt-4o-transcribe",
      "davinci-002",
      "babbage-002",
    ];
    for (const id of dropped) {
      expect(isSelectableOpenAIModel(id), id).toBe(false);
    }
  });

  // The rule filters by exclusion for exactly this: an unknown new family must
  // show up, and the probe decides whether it works.
  it("lets an unknown family through instead of hiding it", () => {
    expect(isSelectableOpenAIModel("gpt-7-turbo-2027")).toBe(true);
    expect(isSelectableOpenAIModel("some-model-that-does-not-exist-yet")).toBe(
      true,
    );
  });

  it("ignores case", () => {
    expect(isSelectableOpenAIModel("TEXT-EMBEDDING-3-SMALL")).toBe(false);
  });
});

describe("sortModels", () => {
  const model = (id: string): LlmModel => ({
    id,
    displayName: id,
    supportsStructuredOutputs: true,
    supportsEffort: null,
  });

  it("sorts stably and predictably", () => {
    const sorted = sortModels([model("gpt-5"), model("gpt-4o"), model("o3")]);
    expect(sorted.map((m) => m.id)).toEqual(["gpt-4o", "gpt-5", "o3"]);
  });

  it("does not mutate the given array", () => {
    const original = [model("z"), model("a")];
    sortModels(original);
    expect(original[0].id).toBe("z");
  });
});

describe("describeCredentialError", () => {
  it("tells an invalid key apart from a permission problem", () => {
    expect(describeCredentialError(apiError(401))).toBe("invalid_key");
    expect(describeCredentialError(apiError(403))).toBe("no_permission");
  });

  it("recognizes an unknown model", () => {
    expect(describeCredentialError(apiError(404))).toBe("unknown_model");
  });

  // The case that sustains the product's promise: without identifying the schema
  // rejection, a model without structured outputs would read as "unknown error".
  it("identifies a schema rejection as a lack of structured outputs", () => {
    const variants = [
      "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model.",
      "output_config.format is not supported by this model",
      "This model does not support structured outputs",
      "Unsupported schema for strict mode",
    ];
    for (const message of variants) {
      expect(describeCredentialError(apiError(400, { message })), message).toBe(
        "no_structured_outputs",
      );
    }
  });

  it("does not mistake another 400 for a lack of structured outputs", () => {
    expect(describeCredentialError(apiError(400, { message: "unknown model id" }))).toBe(
      "unknown_model",
    );
  });

  // Fix: running out of credits used to point at the wrong problem. Anthropic
  // returns 402, or 400 with a "credit balance" message; OpenAI returns 429 with
  // type insufficient_quota. None of them should read as "unknown model",
  // "rate limited", or "unavailable".
  describe("insufficient credits", () => {
    it("maps Anthropic's 402 billing error", () => {
      expect(
        describeCredentialError(apiError(402, { type: "billing_error" })),
      ).toBe("insufficient_credits");
    });

    it("maps Anthropic's low-balance 400 by message, not as unknown model", () => {
      expect(
        describeCredentialError(
          apiError(400, {
            message:
              "Your credit balance is too low to access the Anthropic API.",
          }),
        ),
      ).toBe("insufficient_credits");
    });

    it("maps OpenAI's insufficient_quota by type, not as a rate limit", () => {
      expect(
        describeCredentialError(
          apiError(429, {
            type: "insufficient_quota",
            message:
              "You exceeded your current quota, please check your plan and billing details.",
          }),
        ),
      ).toBe("insufficient_credits");
    });

    it("still treats a real rate limit as rate_limited", () => {
      expect(
        describeCredentialError(
          apiError(429, {
            type: "rate_limit_exceeded",
            message: "Rate limit reached. Please try again in 1s.",
          }),
        ),
      ).toBe("rate_limited");
    });
  });

  it("falls back to unavailable for a network failure or a statusless error", () => {
    expect(describeCredentialError(new Error("fetch failed"))).toBe(
      "unavailable",
    );
    expect(describeCredentialError(apiError(500))).toBe("unavailable");
    expect(describeCredentialError(null)).toBe("unavailable");
  });
});
