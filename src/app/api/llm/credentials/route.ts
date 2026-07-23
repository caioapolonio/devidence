import { NextResponse, type NextRequest } from "next/server";

import { probeStructuredOutputs } from "@/lib/llm";
import { CREDENTIAL_MESSAGES, describeCredentialError } from "@/lib/llm/models";
import { isLlmProvider } from "@/lib/llm/types";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Estado atual das credenciais.
 *
 * Devolve provedor, modelo e data da verificação — **nunca a chave**. Uma chave
 * que sai do servidor de volta para o cliente é uma chave a mais circulando sem
 * motivo.
 */
export async function GET() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  if (!session.llm) return NextResponse.json({ credenciais: null });

  return NextResponse.json({
    credenciais: {
      provider: session.llm.provider,
      model: session.llm.model,
      verifiedAt: session.llm.verifiedAt,
    },
  });
}

/**
 * Sonda o modelo e guarda a credencial.
 *
 * A sonda é o portão: sem ela, um modelo que não devolve saída estruturada só
 * seria descoberto na hora de gerar o relatório — quando já se gastou a busca
 * inteira no GitHub e o usuário está esperando um PDF.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const corpo = (await request.json().catch(() => null)) as {
    provider?: unknown;
    apiKey?: unknown;
    model?: unknown;
  } | null;

  if (!corpo || !isLlmProvider(corpo.provider)) {
    return NextResponse.json({ erro: "Provedor inválido." }, { status: 400 });
  }
  if (typeof corpo.apiKey !== "string" || corpo.apiKey.trim().length === 0) {
    return NextResponse.json({ erro: "Informe a chave." }, { status: 400 });
  }
  if (typeof corpo.model !== "string" || corpo.model.trim().length === 0) {
    return NextResponse.json({ erro: "Escolha um modelo." }, { status: 400 });
  }

  const apiKey = corpo.apiKey.trim();
  const model = corpo.model.trim();

  try {
    const suporta = await probeStructuredOutputs(corpo.provider, apiKey, model);

    if (!suporta) {
      return NextResponse.json(
        {
          erro: CREDENTIAL_MESSAGES.sem_structured_outputs,
          motivo: "sem_structured_outputs",
        },
        { status: 422 },
      );
    }
  } catch (error) {
    const motivo = describeCredentialError(error);
    return NextResponse.json(
      { erro: CREDENTIAL_MESSAGES[motivo], motivo },
      { status: motivo === "indisponivel" ? 502 : 400 },
    );
  }

  const verifiedAt = new Date().toISOString();
  session.llm = { provider: corpo.provider, apiKey, model, verifiedAt };
  await session.save();

  return NextResponse.json({
    credenciais: { provider: corpo.provider, model, verifiedAt },
  });
}

/** Remove a credencial da sessão. Como não há cópia em banco, isso a apaga. */
export async function DELETE() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  delete session.llm;
  await session.save();

  return NextResponse.json({ credenciais: null });
}
