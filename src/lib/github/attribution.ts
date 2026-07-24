/**
 * Personal contribution attribution.
 *
 * A faithful port of `ContributionAttribution.swift` from the macOS app. The
 * question it answers is narrow and load-bearing: does this commit belong to the
 * person the report is about? Getting it wrong in either direction is worse than
 * saying "unsure", which is why the resolver reports *why* it decided, and why
 * the activity layer surfaces coverage gaps rather than guessing.
 *
 * Attribution never infers identity from a commit message beyond the explicit
 * `Co-authored-by` trailer, and never treats a bare name as identity. A name is
 * not proof; a GitHub login, a confirmed email, or a co-author email is.
 */

export type AttributionReason =
  | "github_login"
  | "confirmed_email"
  | "coauthored_email"
  | "none";

export type Attribution = {
  isPersonal: boolean;
  reason: AttributionReason;
};

/**
 * The identity the report is about: the set of GitHub logins and emails known to
 * belong to the person. Both are compared lowercased, so callers may pass any
 * casing.
 */
export type Identity = {
  logins: Set<string>;
  emails: Set<string>;
};

/** The subset of a commit attribution needs. */
export type AttributableCommit = {
  authorLogin: string | null;
  authorEmail: string | null;
  /** Full commit message: headline plus body. */
  message: string;
};

export function makeIdentity(
  logins: Iterable<string>,
  emails: Iterable<string>,
): Identity {
  return {
    logins: new Set([...logins].map((l) => l.toLowerCase())),
    emails: new Set([...emails].map((e) => e.toLowerCase())),
  };
}

/**
 * Resolves attribution in the same priority order as the macOS app:
 *
 *   1. GitHub login of the commit author.
 *   2. Confirmed email of the commit author.
 *   3. A `Co-authored-by` email that matches a known identity email.
 *
 * The order matters: login is the strongest signal (GitHub resolved it to an
 * account), email next, co-authorship last. Co-authorship is attributed *only*
 * by email, never by the name in the trailer.
 */
export function resolveAttribution(
  commit: AttributableCommit,
  identity: Identity,
): Attribution {
  const login = commit.authorLogin?.toLowerCase();
  if (login && identity.logins.has(login)) {
    return { isPersonal: true, reason: "github_login" };
  }

  const email = commit.authorEmail?.toLowerCase();
  if (email && identity.emails.has(email)) {
    return { isPersonal: true, reason: "confirmed_email" };
  }

  for (const coauthor of coauthorEmails(commit.message)) {
    if (identity.emails.has(coauthor)) {
      return { isPersonal: true, reason: "coauthored_email" };
    }
  }

  return { isPersonal: false, reason: "none" };
}

/**
 * Extracts the emails from `Co-authored-by:` trailers.
 *
 * The pattern mirrors the Swift original: multiline, case-insensitive, one
 * trailer per line, email captured from inside the angle brackets. Anything
 * without an email in brackets is ignored, because a name alone is not identity.
 *
 * The Swift version used `NSRegularExpression`; this uses the JS engine, so the
 * flags map to `gim` and `\s` covers the same whitespace. The tests pin the
 * behavior rather than trusting the two engines to agree.
 */
export function coauthorEmails(message: string): Set<string> {
  const pattern = /^[ \t]*co-authored-by[ \t]*:[^\r\n<]*<[ \t]*([^>\s]+)[ \t]*>[ \t]*$/gim;
  const emails = new Set<string>();

  for (const match of message.matchAll(pattern)) {
    if (match[1]) emails.add(match[1].toLowerCase());
  }

  return emails;
}
