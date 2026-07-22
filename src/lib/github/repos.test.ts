import { describe, expect, it } from "vitest";

import {
  filterRepositories,
  normalizeRepository,
  sortByRecentActivity,
  type RawRepository,
  type Repository,
} from "@/lib/github/repos";

function raw(overrides: Partial<RawRepository> = {}): RawRepository {
  return {
    id: 1,
    name: "devidence",
    full_name: "caioapolonio/devidence",
    owner: { login: "caioapolonio" },
    private: false,
    archived: false,
    fork: false,
    default_branch: "main",
    html_url: "https://github.com/caioapolonio/devidence",
    pushed_at: "2026-07-22T12:00:00Z",
    description: null,
    ...overrides,
  };
}

function repo(overrides: Partial<Repository> = {}): Repository {
  return { ...normalizeRepository(raw()), ...overrides };
}

describe("normalizeRepository", () => {
  it("guarda só os campos que o app usa", () => {
    expect(normalizeRepository(raw())).toEqual({
      id: 1,
      name: "devidence",
      fullName: "caioapolonio/devidence",
      owner: "caioapolonio",
      isPrivate: false,
      isArchived: false,
      isFork: false,
      defaultBranch: "main",
      htmlUrl: "https://github.com/caioapolonio/devidence",
      pushedAt: "2026-07-22T12:00:00Z",
      description: null,
    });
  });

  it("deriva o dono do full_name quando o owner vem nulo", () => {
    const normalized = normalizeRepository(raw({ owner: null }));
    expect(normalized.owner).toBe("caioapolonio");
  });

  it("preserva o sinal de repositório privado", () => {
    expect(normalizeRepository(raw({ private: true })).isPrivate).toBe(true);
  });
});

describe("sortByRecentActivity", () => {
  it("coloca os mais recentes primeiro", () => {
    const ordenados = sortByRecentActivity([
      repo({ fullName: "a/antigo", pushedAt: "2025-01-01T00:00:00Z" }),
      repo({ fullName: "a/novo", pushedAt: "2026-07-01T00:00:00Z" }),
      repo({ fullName: "a/medio", pushedAt: "2026-01-01T00:00:00Z" }),
    ]);

    expect(ordenados.map((r) => r.fullName)).toEqual([
      "a/novo",
      "a/medio",
      "a/antigo",
    ]);
  });

  it("manda repositório sem push para o fim, sem descartar", () => {
    const ordenados = sortByRecentActivity([
      repo({ fullName: "a/vazio", pushedAt: null }),
      repo({ fullName: "a/ativo", pushedAt: "2026-07-01T00:00:00Z" }),
    ]);

    expect(ordenados.map((r) => r.fullName)).toEqual(["a/ativo", "a/vazio"]);
    expect(ordenados).toHaveLength(2);
  });

  it("desempata por nome para a ordem ser estável", () => {
    const mesmaData = "2026-07-01T00:00:00Z";
    const ordenados = sortByRecentActivity([
      repo({ fullName: "z/projeto", pushedAt: mesmaData }),
      repo({ fullName: "a/projeto", pushedAt: mesmaData }),
    ]);

    expect(ordenados.map((r) => r.fullName)).toEqual([
      "a/projeto",
      "z/projeto",
    ]);
  });

  it("não altera o array recebido", () => {
    const original = [
      repo({ fullName: "a/antigo", pushedAt: "2025-01-01T00:00:00Z" }),
      repo({ fullName: "a/novo", pushedAt: "2026-07-01T00:00:00Z" }),
    ];
    sortByRecentActivity(original);
    expect(original[0].fullName).toBe("a/antigo");
  });
});

describe("filterRepositories", () => {
  const repositorios = [
    repo({ fullName: "caioapolonio/devidence", description: "Relatórios" }),
    repo({ fullName: "caioapolonio/cinebaltar", description: null }),
    repo({ fullName: "empresa/API-Pagamentos", description: "Cobrança" }),
  ];

  it("devolve tudo quando a busca está vazia", () => {
    expect(filterRepositories(repositorios, "   ")).toHaveLength(3);
  });

  it("ignora maiúsculas", () => {
    const achados = filterRepositories(repositorios, "api-pagamentos");
    expect(achados.map((r) => r.fullName)).toEqual(["empresa/API-Pagamentos"]);
  });

  it("ignora acentos nos dois sentidos", () => {
    expect(filterRepositories(repositorios, "relatorios")).toHaveLength(1);
    expect(filterRepositories(repositorios, "cobrança")).toHaveLength(1);
  });

  it("também procura na descrição", () => {
    const achados = filterRepositories(repositorios, "cobranca");
    expect(achados.map((r) => r.fullName)).toEqual(["empresa/API-Pagamentos"]);
  });

  it("devolve vazio quando nada bate", () => {
    expect(filterRepositories(repositorios, "inexistente")).toEqual([]);
  });
});
