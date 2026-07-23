import { describe, expect, it, vi } from "vitest";

import {
  buildAuthorizeUrl,
  buildRedirectUri,
  createState,
  exchangeCodeForToken,
  fetchGitHubUser,
  GITHUB_SCOPES,
  isValidState,
  mapGitHubError,
} from "@/lib/auth/github-oauth";

describe("createState", () => {
  it("generates a value long enough not to be guessed", () => {
    // 32 bytes in hex.
    expect(createState()).toHaveLength(64);
  });

  it("does not repeat across calls", () => {
    const samples = new Set(Array.from({ length: 100 }, () => createState()));
    expect(samples.size).toBe(100);
  });
});

describe("isValidState", () => {
  it("accepts only the identical value", () => {
    const state = createState();
    expect(isValidState(state, state)).toBe(true);
  });

  it("rejects a different value", () => {
    expect(isValidState(createState(), createState())).toBe(false);
  });

  // These are the cases that open the door to CSRF: with no cookie, no
  // parameter, or an empty string, the comparison must not pass by accident.
  it("rejects when either side is missing", () => {
    const state = createState();
    expect(isValidState(state, undefined)).toBe(false);
    expect(isValidState(undefined, state)).toBe(false);
    expect(isValidState(null, null)).toBe(false);
    expect(isValidState("", "")).toBe(false);
  });

  it("rejects a prefix of the correct value", () => {
    const state = createState();
    expect(isValidState(state.slice(0, 32), state)).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  const url = new URL(
    buildAuthorizeUrl({
      clientId: "Iv1.abc123",
      redirectUri: "https://devidence.app/api/auth/callback",
      state: "fixed-state",
    }),
  );

  it("points at GitHub's authorize endpoint", () => {
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
  });

  it("requests exactly the declared scopes, space-separated", () => {
    expect(url.searchParams.get("scope")).toBe("read:user repo");
    expect(GITHUB_SCOPES).toEqual(["read:user", "repo"]);
  });

  it("carries the state and the redirect", () => {
    expect(url.searchParams.get("state")).toBe("fixed-state");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://devidence.app/api/auth/callback",
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.abc123");
  });
});

describe("buildRedirectUri", () => {
  it("builds the callback from the app's origin", () => {
    expect(buildRedirectUri("http://localhost:3000")).toBe(
      "http://localhost:3000/api/auth/callback",
    );
    // Does not double the slash when the origin already ends with one.
    expect(buildRedirectUri("https://devidence.app/")).toBe(
      "https://devidence.app/api/auth/callback",
    );
  });
});

describe("mapGitHubError", () => {
  it("tells a user decline apart from a generic failure", () => {
    expect(mapGitHubError("access_denied")).toBe("access_denied");
    expect(mapGitHubError("bad_verification_code")).toBe("exchange_failed");
  });

  it("returns null when there was no error", () => {
    expect(mapGitHubError(null)).toBeNull();
  });
});

describe("exchangeCodeForToken", () => {
  const params = {
    clientId: "id",
    clientSecret: "secret",
    code: "code",
    redirectUri: "http://localhost:3000/api/auth/callback",
  };

  it("asks for JSON explicitly, since without it GitHub replies form-encoded", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ access_token: "gho_token" }),
    );

    await exchangeCodeForToken({ ...params, fetchImpl });

    const init = fetchImpl.mock.calls[0][1];
    expect((init?.headers as Record<string, string>).Accept).toBe(
      "application/json",
    );
  });

  it("returns the token when the exchange succeeds", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ access_token: "gho_token" }),
    );
    await expect(exchangeCodeForToken({ ...params, fetchImpl })).resolves.toBe(
      "gho_token",
    );
  });

  it("returns null when GitHub replies with an error body at status 200", async () => {
    // GitHub replies 200 with {error: ...} for an invalid code.
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "bad_verification_code" }),
    );
    await expect(
      exchangeCodeForToken({ ...params, fetchImpl }),
    ).resolves.toBeNull();
  });

  it("returns null when the response is not ok", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("", { status: 500 }),
    );
    await expect(
      exchangeCodeForToken({ ...params, fetchImpl }),
    ).resolves.toBeNull();
  });
});

describe("fetchGitHubUser", () => {
  it("normalizes avatar_url to avatarUrl", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        id: 101,
        login: "caioapolonio",
        name: "Caio Vinicius",
        avatar_url: "https://avatars.githubusercontent.com/u/101",
      }),
    );

    await expect(fetchGitHubUser("gho_token", fetchImpl)).resolves.toEqual({
      id: 101,
      login: "caioapolonio",
      name: "Caio Vinicius",
      avatarUrl: "https://avatars.githubusercontent.com/u/101",
    });
  });

  it("sends the token as a Bearer", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 1, login: "x", name: null, avatar_url: "u" }),
    );

    await fetchGitHubUser("gho_token", fetchImpl);

    const init = fetchImpl.mock.calls[0][1];
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer gho_token",
    );
  });

  it("returns null when the token is no good", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("", { status: 401 }),
    );
    await expect(fetchGitHubUser("expired", fetchImpl)).resolves.toBeNull();
  });
});
