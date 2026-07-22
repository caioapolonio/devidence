import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Encerra a sessão.
 *
 * Como o token do GitHub só existe dentro do cookie, destruir a sessão apaga o
 * token de verdade — não há cópia em banco para revogar depois.
 *
 * É POST de propósito: logout por GET é acionável por `<img src>` de terceiro.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
