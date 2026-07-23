import { NextResponse, type NextRequest } from "next/server";

import { listModels } from "@/lib/llm";
import { CREDENTIAL_MESSAGES, describeCredentialError } from "@/lib/llm/models";
import { isLlmProvider } from "@/lib/llm/types";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Lista os modelos que a chave enxerga.
 *
 * POST, e não GET, porque a chave vai no corpo: numa query string ela acabaria
 * em log de servidor, histórico do navegador e cabeçalho `Referer`.
 *
 * A chave é usada e descartada — só é guardada na sessão depois que a sonda
 * confirmar o modelo escolhido.
 */
export async function POST(request: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const corpo = (await request.json().catch(() => null)) as {
    provider?: unknown;
    apiKey?: unknown;
  } | null;

  if (!corpo || !isLlmProvider(corpo.provider)) {
    return NextResponse.json({ erro: "Provedor inválido." }, { status: 400 });
  }
  if (typeof corpo.apiKey !== "string" || corpo.apiKey.trim().length === 0) {
    return NextResponse.json({ erro: "Informe a chave." }, { status: 400 });
  }

  try {
    const models = await listModels(corpo.provider, corpo.apiKey.trim());

    if (models.length === 0) {
      return NextResponse.json(
        {
          erro: "Nenhum modelo compatível está disponível para esta chave.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ models });
  } catch (error) {
    const motivo = describeCredentialError(error);
    return NextResponse.json(
      { erro: CREDENTIAL_MESSAGES[motivo], motivo },
      { status: motivo === "indisponivel" ? 502 : 400 },
    );
  }
}
