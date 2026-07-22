/**
 * Cliente do backend.
 *
 * O browser fala apenas com este serviço: nenhuma chamada ao GitHub ou à
 * OpenAI parte daqui, porque as credenciais da plataforma nunca chegam ao
 * cliente.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Health = {
  status: "ok" | "degraded";
  database: "ok" | "unavailable";
  redis: "ok" | "unavailable";
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    throw new ApiError(`Falha ao consultar ${path}.`, response.status);
  }

  return (await response.json()) as T;
}

/**
 * O `/health` responde 503 quando degradado, então o `apiFetch` lançaria.
 * Aqui o corpo importa mais que o código: queremos nomear a dependência que
 * caiu, não apenas dizer que algo falhou.
 */
export async function fetchHealth(): Promise<Health | null> {
  try {
    const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
    return (await response.json()) as Health;
  } catch {
    return null;
  }
}
