import { describe, expect, it } from "vitest";

import {
  redactSecrets,
  sanitize,
  sanitizeURL,
  type DiffInput,
} from "@/lib/evidence/sanitizer";

/**
 * Secret-shaped fixtures are assembled from parts on purpose.
 *
 * Every value here is fabricated, but a literal token in the source looks real
 * enough to trip GitHub's secret scanning (a Google-key-shaped fixture did just
 * that). Splitting each into `prefix + filler` keeps no scannable token in the
 * file, while the assembled runtime value still matches its redaction rule. Each
 * filler length clears the rule's minimum.
 */
const fake = {
  githubClassic: () => "ghp_" + "a".repeat(36),
  githubPat: () => "github_pat_" + "b".repeat(40),
  openai: () => "sk-" + "c".repeat(24),
  openaiProject: () => "sk-proj-" + "d".repeat(36),
  aws: () => "AKIA" + "E".repeat(16),
  google: () => "AIza" + "f".repeat(35),
  slack: () => "xoxb-" + "g".repeat(12),
  jwt: () => "eyJ" + "h".repeat(10) + "." + "i".repeat(10) + "." + "j".repeat(10),
};

describe("sanitize: secrets are removed before anything leaves", () => {
  it("redacts known and generic secrets", () => {
    const githubToken = fake.githubClassic();
    const openAIKey = fake.openaiProject();
    const input: DiffInput = {
      path: "src/Client.ts",
      patch: `+ const github = "${githubToken}"\n+ api_key = "${openAIKey}"\n+ password=correct-horse-battery\n+ Authorization: Bearer abcdefghijklmnop`,
    };

    const result = sanitize([input]);
    const diff = result.included[0];

    expect(diff).toBeDefined();
    expect(diff.patch).not.toContain(githubToken);
    expect(diff.patch).not.toContain(openAIKey);
    expect(diff.patch).not.toContain("correct-horse-battery");
    expect(diff.patch).not.toContain("abcdefghijklmnop");
    expect(diff.patch).toContain("<REDACTED_SECRET>");
    expect(diff.redactionCount).toBeGreaterThanOrEqual(4);
  });

  it("redacts a token pasted into a file path too", () => {
    const result = sanitize([
      { path: `src/token-${fake.githubClassic()}.ts`, patch: "+ ok" },
    ]);
    expect(result.included[0].path).toContain("<REDACTED_SECRET>");
  });
});

describe("sanitize: unsafe files are blocked", () => {
  it("drops sensitive, generated, binary, and private-key files, in that order", () => {
    const inputs: DiffInput[] = [
      { path: ".env.production", patch: "+TOKEN=value" },
      { path: "package-lock.json", patch: "+ generated" },
      { path: "src/Data.bin", patch: "GIT binary patch\nabc" },
      { path: "src/Embedded.ts", patch: "+ -----BEGIN PRIVATE KEY-----\nsecret" },
    ];

    const result = sanitize(inputs);
    expect(result.included).toHaveLength(0);
    expect(result.excluded.map((e) => e.reason)).toEqual([
      "sensitivePath",
      "generated",
      "binary",
      "secretContent",
    ]);
  });

  it("recognizes sensitive names, extensions, and directory segments", () => {
    for (const path of [
      ".env",
      "config/credentials.json",
      "deploy/server.pem",
      "keys/private.p12",
      "home/.ssh/id_rsa",
      "app/.aws/config",
    ]) {
      const result = sanitize([{ path, patch: "+ x" }]);
      expect(result.excluded[0]?.reason, path).toBe("sensitivePath");
    }
  });

  it("recognizes generated lockfiles, directories, and suffixes", () => {
    for (const path of [
      "yarn.lock",
      "node_modules/pkg/index.js",
      "dist/bundle.js",
      "app/api.min.js",
      "model.pb.swift",
    ]) {
      const result = sanitize([{ path, patch: "+ x" }]);
      expect(result.excluded[0]?.reason, path).toBe("generated");
    }
  });

  it("recognizes binaries by extension and by patch marker", () => {
    expect(sanitize([{ path: "logo.png", patch: "+ x" }]).excluded[0].reason).toBe("binary");
    expect(
      sanitize([{ path: "src/x.ts", patch: "Binary files a and b differ" }]).excluded[0].reason,
    ).toBe("binary");
  });
});

describe("sanitize: limits are deterministic", () => {
  it("enforces per-diff, total, and count limits", () => {
    const result = sanitize(
      [
        { path: "A.ts", patch: "a".repeat(100) },
        { path: "B.ts", patch: "b".repeat(100) },
        { path: "C.ts", patch: "small" },
      ],
      {
        maximumFiles: 2,
        maximumCharactersPerDiff: 30,
        maximumTotalDiffCharacters: 45,
      },
    );

    expect(result.included).toHaveLength(2);
    expect(result.included[0].patch.length).toBe(30);
    expect(result.included[1].patch.length).toBe(15);
    expect(result.included.every((d) => d.wasTruncated)).toBe(true);

    // C is dropped by the file limit, checked before anything about its path.
    expect(result.excluded[0]).toEqual({ path: "C.ts", reason: "fileLimit" });
  });

  it("appends the truncation marker when there is room for it", () => {
    const result = sanitize([{ path: "A.ts", patch: "x".repeat(200) }], {
      maximumFiles: 1,
      maximumCharactersPerDiff: 50,
      maximumTotalDiffCharacters: 1000,
    });
    expect(result.included[0].patch.endsWith("<DIFF_TRUNCATED>")).toBe(true);
    expect(result.included[0].patch.length).toBe(50);
  });
});

describe("redactSecrets: rule coverage", () => {
  // One example per token family, so a regression in any single rule is caught.
  const cases: Array<[string, string]> = [
    ["github classic", fake.githubClassic()],
    ["github pat", fake.githubPat()],
    ["openai", fake.openai()],
    ["aws access key", fake.aws()],
    ["google api key", fake.google()],
    ["slack", fake.slack()],
    ["jwt", fake.jwt()],
  ];

  for (const [name, secret] of cases) {
    it(`redacts ${name}`, () => {
      const result = redactSecrets(`value = ${secret}`);
      expect(result.text).not.toContain(secret);
      expect(result.text).toContain("<REDACTED_SECRET>");
      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  }

  it("leaves ordinary text untouched", () => {
    const result = redactSecrets("+ const total = subtotal + tax;");
    expect(result).toEqual({ text: "+ const total = subtotal + tax;", count: 0 });
  });
});

describe("sanitizeURL", () => {
  it("strips credentials, query, and fragment", () => {
    expect(
      sanitizeURL("https://user:pw@github.com/acme/app/pull/42?access_token=secret#top"),
    ).toBe("https://github.com/acme/app/pull/42");
  });

  it("returns empty for an unparseable URL", () => {
    expect(sanitizeURL("not a url")).toBe("");
  });
});
