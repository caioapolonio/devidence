/**
 * Diff sanitizer.
 *
 * A faithful port of `EvidenceSanitizer.swift`. This is the gate every diff
 * passes before it can reach an LLM, and the rule is: never loosen anything.
 * Secrets are redacted, sensitive/generated/binary files are dropped whole,
 * private keys block the file, and everything is bounded so a payload can't blow
 * past the documented limits.
 *
 * The regexes come straight from the macOS app, which used
 * `NSRegularExpression`. JavaScript's engine differs at the edges, so every rule
 * is pinned by a test rather than trusting the two engines to agree. The only
 * deliberate translation: the last three rules used an inline `(?i)`, which JS
 * doesn't apply the same way, so those three carry the `i` flag instead and
 * rules 1 through 7 stay case-sensitive, exactly as before.
 */

export type SanitizationPolicy = {
  maximumFiles: number;
  maximumCharactersPerDiff: number;
  maximumTotalDiffCharacters: number;
};

export const DEFAULT_POLICY: SanitizationPolicy = {
  maximumFiles: 20,
  maximumCharactersPerDiff: 12_000,
  maximumTotalDiffCharacters: 80_000,
};

export type DiffExclusionReason =
  | "sensitivePath"
  | "binary"
  | "generated"
  | "secretContent"
  | "fileLimit"
  | "totalCharacterLimit";

export type DiffInput = {
  path: string;
  patch: string;
};

export type SanitizedDiff = {
  path: string;
  patch: string;
  wasTruncated: boolean;
  redactionCount: number;
};

export type ExcludedDiff = {
  path: string;
  reason: DiffExclusionReason;
};

export type SanitizationResult = {
  included: SanitizedDiff[];
  excluded: ExcludedDiff[];
};

export function totalRedactions(result: SanitizationResult): number {
  return result.included.reduce((sum, d) => sum + d.redactionCount, 0);
}

function normalizePolicy(policy: SanitizationPolicy): SanitizationPolicy {
  return {
    maximumFiles: Math.max(0, policy.maximumFiles),
    maximumCharactersPerDiff: Math.max(0, policy.maximumCharactersPerDiff),
    maximumTotalDiffCharacters: Math.max(0, policy.maximumTotalDiffCharacters),
  };
}

export function sanitize(
  inputs: DiffInput[],
  rawPolicy: SanitizationPolicy = DEFAULT_POLICY,
): SanitizationResult {
  const policy = normalizePolicy(rawPolicy);
  const included: SanitizedDiff[] = [];
  const excluded: ExcludedDiff[] = [];
  let usedCharacters = 0;

  for (const input of inputs) {
    // Order matters: the exclusion reasons are asserted in this sequence.
    if (included.length >= policy.maximumFiles) {
      excluded.push({ path: input.path, reason: "fileLimit" });
      continue;
    }
    if (isSensitivePath(input.path)) {
      excluded.push({ path: input.path, reason: "sensitivePath" });
      continue;
    }
    if (isGeneratedPath(input.path)) {
      excluded.push({ path: input.path, reason: "generated" });
      continue;
    }
    if (isBinary(input)) {
      excluded.push({ path: input.path, reason: "binary" });
      continue;
    }
    if (containsPrivateKey(input.patch)) {
      excluded.push({ path: input.path, reason: "secretContent" });
      continue;
    }

    const remaining = policy.maximumTotalDiffCharacters - usedCharacters;
    if (remaining <= 0) {
      excluded.push({ path: input.path, reason: "totalCharacterLimit" });
      continue;
    }

    const redacted = redactSecrets(input.patch);
    const allowed = Math.min(policy.maximumCharactersPerDiff, remaining);
    const limited = limit(redacted.text, allowed);
    included.push({
      path: sanitizeMetadata(input.path),
      patch: limited.text,
      wasTruncated: limited.wasTruncated,
      redactionCount: redacted.count,
    });
    usedCharacters += limited.text.length;
  }

  return { included, excluded };
}

/**
 * Redacts metadata and free-form user context before it reaches a preview or a
 * network request. It intentionally shares the diff secret rules, so a token
 * pasted into a file path is scrubbed too.
 */
export function sanitizeMetadata(text: string): string {
  return redactSecrets(text).text;
}

/**
 * GitHub evidence links need no credentials, query parameters, or fragments.
 * Removing them also prevents an accidental signed URL or token from entering
 * the payload.
 */
export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return sanitizeMetadata(parsed.toString());
  } catch {
    return "";
  }
}

function lastSegment(path: string): string {
  const normalized = path.toLowerCase().replaceAll("\\", "/");
  const parts = normalized.split("/").filter((s) => s.length > 0);
  return parts.length > 0 ? parts[parts.length - 1] : normalized;
}

function isSensitivePath(path: string): boolean {
  const normalized = "/" + path.toLowerCase().replaceAll("\\", "/");
  const name = lastSegment(path);

  const sensitiveNames = new Set([
    ".env",
    "credentials",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_ed25519",
    ".netrc",
    ".npmrc",
    ".pypirc",
  ]);
  const sensitiveExtensions = new Set([
    "pem",
    "key",
    "p8",
    "p12",
    "pfx",
    "cer",
    "crt",
    "der",
    "mobileprovision",
    "keystore",
    "jks",
  ]);
  const sensitiveSegments = ["/.ssh/", "/.aws/", "/.gnupg/", "/secrets/"];

  if (sensitiveNames.has(name) || name.startsWith(".env.")) return true;

  const parts = name.split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : "";
  if (extension && sensitiveExtensions.has(extension)) return true;

  return sensitiveSegments.some((segment) => normalized.includes(segment));
}

function isGeneratedPath(path: string): boolean {
  const normalized = "/" + path.toLowerCase().replaceAll("\\", "/");
  const name = lastSegment(path);

  const generatedSegments = [
    "/deriveddata/",
    "/.build/",
    "/build/",
    "/dist/",
    "/node_modules/",
    "/pods/",
    "/vendor/",
    "/generated/",
  ];
  const generatedNames = new Set([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "podfile.lock",
    "cartfile.resolved",
    "package.resolved",
    "composer.lock",
    "gemfile.lock",
  ]);
  const generatedSuffixes = [
    ".generated.swift",
    ".g.swift",
    ".pb.swift",
    ".min.js",
    ".min.css",
  ];

  return (
    generatedNames.has(name) ||
    generatedSegments.some((segment) => normalized.includes(segment)) ||
    generatedSuffixes.some((suffix) => name.endsWith(suffix))
  );
}

function isBinary(input: DiffInput): boolean {
  const name = lastSegment(input.path);
  const binaryExtensions = new Set([
    "png", "jpg", "jpeg", "gif", "heic", "webp", "pdf", "zip",
    "gz", "bz2", "xz", "7z", "dmg", "pkg", "a", "o", "dylib",
    "sqlite", "db", "woff", "woff2", "ttf", "otf", "mp3", "mp4", "mov",
  ]);

  const parts = name.split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : "";
  const hasBinaryExtension = extension.length > 0 && binaryExtensions.has(extension);

  const patch = input.patch;
  return (
    hasBinaryExtension ||
    patch.includes("\0") ||
    patch.toLowerCase().includes("git binary patch") ||
    patch.toLowerCase().includes("binary files ")
  );
}

function containsPrivateKey(text: string): boolean {
  return /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/i.test(text);
}

/**
 * The ten redaction rules, in order. Rules 1 through 7 are case-sensitive on
 * purpose (token prefixes like `AKIA`, `sk-`, `eyJ` are literal). Rules 8
 * through 10 carry the `i` flag, standing in for the original inline `(?i)`.
 */
const REDACTION_RULES: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\bauthorization\b\s*:\s*(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|password|passwd)\b\s*[:=]\s*["'][^"'\r\n]{4,}["']/gi,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|password|passwd)\b\s*[:=]\s*[^\s,;\r\n]{6,}/gi,
];

export function redactSecrets(text: string): { text: string; count: number } {
  let output = text;
  let count = 0;

  for (const rule of REDACTION_RULES) {
    const matches = output.match(rule);
    if (!matches || matches.length === 0) continue;
    count += matches.length;
    output = output.replace(rule, "<REDACTED_SECRET>");
  }

  return { text: output, count };
}

const TRUNCATION_MARKER = "\n… <DIFF_TRUNCATED>";

function limit(
  text: string,
  maximumCharacters: number,
): { text: string; wasTruncated: boolean } {
  if (text.length <= maximumCharacters) return { text, wasTruncated: false };
  if (maximumCharacters <= 0) return { text: "", wasTruncated: true };

  if (TRUNCATION_MARKER.length >= maximumCharacters) {
    return {
      text: TRUNCATION_MARKER.slice(0, maximumCharacters),
      wasTruncated: true,
    };
  }
  return {
    text: text.slice(0, maximumCharacters - TRUNCATION_MARKER.length) + TRUNCATION_MARKER,
    wasTruncated: true,
  };
}
