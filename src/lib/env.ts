/**
 * Server-side environment variables.
 *
 * Reading through this module instead of scattering `process.env` around the
 * codebase gives a clear failure on the first call when configuration is
 * missing, instead of an `undefined` that only turns into a strange error
 * three layers deeper.
 *
 * Nothing here may be imported by a client component.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Environment variable ${name} is not set. See .env.example.`,
    );
  }
  return value;
}

export const serverEnv = {
  get githubClientId() {
    return required("GITHUB_CLIENT_ID");
  },
  get githubClientSecret() {
    return required("GITHUB_CLIENT_SECRET");
  },
  /** At least 32 characters, required by iron-session. */
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32",
      );
    }
    return secret;
  },
  /** Public origin of the app, used to build the OAuth redirect. */
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
};

export const isProduction = process.env.NODE_ENV === "production";
