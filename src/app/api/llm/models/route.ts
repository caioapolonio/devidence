import { NextResponse, type NextRequest } from "next/server";

import { listModels } from "@/lib/llm";
import { CREDENTIAL_MESSAGES, describeCredentialError } from "@/lib/llm/models";
import { isLlmProvider } from "@/lib/llm/types";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Lists the models the key can see.
 *
 * POST, not GET, because the key goes in the body: in a query string it would
 * end up in server logs, browser history, and the `Referer` header.
 *
 * The key is used and discarded here. It is only saved to the session after the
 * probe confirms the chosen model.
 */
export async function POST(request: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    provider?: unknown;
    apiKey?: unknown;
  } | null;

  if (!body || !isLlmProvider(body.provider)) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }
  if (typeof body.apiKey !== "string" || body.apiKey.trim().length === 0) {
    return NextResponse.json({ error: "Enter a key." }, { status: 400 });
  }

  try {
    const models = await listModels(body.provider, body.apiKey.trim());

    if (models.length === 0) {
      return NextResponse.json(
        { error: "No compatible model is available for this key." },
        { status: 422 },
      );
    }

    return NextResponse.json({ models });
  } catch (error) {
    const reason = describeCredentialError(error);
    return NextResponse.json(
      { error: CREDENTIAL_MESSAGES[reason], reason },
      { status: reason === "unavailable" ? 502 : 400 },
    );
  }
}
