import { NextResponse } from "next/server";

import { createGitHubClient, listRepositories } from "@/lib/github/client";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  try {
    const repositories = await listRepositories(
      createGitHubClient(user.accessToken),
    );
    return NextResponse.json({ repositories });
  } catch (error) {
    // Token revogado no GitHub continua parecendo válido para nós até a
    // primeira chamada falhar. 401 aqui faz o cliente mandar relogar em vez de
    // mostrar "erro desconhecido".
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 401
    ) {
      return NextResponse.json(
        { erro: "Sua autorização no GitHub não é mais válida. Entre de novo." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { erro: "Não foi possível listar seus repositórios." },
      { status: 502 },
    );
  }
}
