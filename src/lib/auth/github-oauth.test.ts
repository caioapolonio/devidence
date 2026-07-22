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
  it("gera valor longo o bastante para não ser adivinhado", () => {
    // 32 bytes em hex.
    expect(createState()).toHaveLength(64);
  });

  it("não repete entre chamadas", () => {
    const amostras = new Set(Array.from({ length: 100 }, () => createState()));
    expect(amostras.size).toBe(100);
  });
});

describe("isValidState", () => {
  it("aceita apenas o valor idêntico", () => {
    const state = createState();
    expect(isValidState(state, state)).toBe(true);
  });

  it("rejeita valor diferente", () => {
    expect(isValidState(createState(), createState())).toBe(false);
  });

  // Estes são os casos que abrem a porta para CSRF: sem cookie, sem parâmetro,
  // ou com string vazia, a comparação não pode passar por acidente.
  it("rejeita quando algum dos lados está ausente", () => {
    const state = createState();
    expect(isValidState(state, undefined)).toBe(false);
    expect(isValidState(undefined, state)).toBe(false);
    expect(isValidState(null, null)).toBe(false);
    expect(isValidState("", "")).toBe(false);
  });

  it("rejeita prefixo do valor correto", () => {
    const state = createState();
    expect(isValidState(state.slice(0, 32), state)).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  const url = new URL(
    buildAuthorizeUrl({
      clientId: "Iv1.abc123",
      redirectUri: "https://devidence.app/api/auth/callback",
      state: "estado-fixo",
    }),
  );

  it("aponta para o endpoint de autorização do GitHub", () => {
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
  });

  it("pede exatamente os escopos declarados, separados por espaço", () => {
    expect(url.searchParams.get("scope")).toBe("read:user repo");
    expect(GITHUB_SCOPES).toEqual(["read:user", "repo"]);
  });

  it("leva o state e o redirect", () => {
    expect(url.searchParams.get("state")).toBe("estado-fixo");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://devidence.app/api/auth/callback",
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.abc123");
  });
});

describe("buildRedirectUri", () => {
  it("monta o callback a partir da origem da aplicação", () => {
    expect(buildRedirectUri("http://localhost:3000")).toBe(
      "http://localhost:3000/api/auth/callback",
    );
    // Não duplica a barra quando a origem já termina com uma.
    expect(buildRedirectUri("https://devidence.app/")).toBe(
      "https://devidence.app/api/auth/callback",
    );
  });
});

describe("mapGitHubError", () => {
  it("distingue recusa do usuário de falha genérica", () => {
    expect(mapGitHubError("access_denied")).toBe("acesso_negado");
    expect(mapGitHubError("bad_verification_code")).toBe("troca_falhou");
  });

  it("devolve null quando não houve erro", () => {
    expect(mapGitHubError(null)).toBeNull();
  });
});

describe("exchangeCodeForToken", () => {
  const params = {
    clientId: "id",
    clientSecret: "segredo",
    code: "codigo",
    redirectUri: "http://localhost:3000/api/auth/callback",
  };

  it("pede JSON explicitamente — sem isso o GitHub responde form-encoded", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ access_token: "gho_token" }),
    );

    await exchangeCodeForToken({ ...params, fetchImpl });

    const init = fetchImpl.mock.calls[0][1];
    expect((init?.headers as Record<string, string>).Accept).toBe(
      "application/json",
    );
  });

  it("devolve o token quando a troca dá certo", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ access_token: "gho_token" }),
    );
    await expect(exchangeCodeForToken({ ...params, fetchImpl })).resolves.toBe(
      "gho_token",
    );
  });

  it("devolve null quando o GitHub responde erro no corpo com status 200", async () => {
    // O GitHub responde 200 com {error: ...} para code inválido.
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: "bad_verification_code" }),
    );
    await expect(
      exchangeCodeForToken({ ...params, fetchImpl }),
    ).resolves.toBeNull();
  });

  it("devolve null quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    await expect(
      exchangeCodeForToken({ ...params, fetchImpl }),
    ).resolves.toBeNull();
  });
});

describe("fetchGitHubUser", () => {
  it("normaliza avatar_url para avatarUrl", async () => {
    const fetchImpl = vi.fn(async () =>
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

  it("envia o token como Bearer", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 1, login: "x", name: null, avatar_url: "u" }),
    );

    await fetchGitHubUser("gho_token", fetchImpl);

    const init = fetchImpl.mock.calls[0][1];
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer gho_token",
    );
  });

  it("devolve null quando o token não serve", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));
    await expect(fetchGitHubUser("expirado", fetchImpl)).resolves.toBeNull();
  });
});
