import { NextResponse, type NextRequest } from "next/server";

import { probeStructuredOutputs } from "@/lib/llm";
import { CREDENTIAL_MESSAGES, describeCredentialError } from "@/lib/llm/models";
import { isLlmProvider } from "@/lib/llm/types";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Current state of the credentials.
 *
 * Returns provider, model, and verification date, but never the key. A key that
 * leaves the server back to the client is one more key circulating for no
 * reason.
 */
export async function GET() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  if (!session.llm) return NextResponse.json({ credentials: null });

  return NextResponse.json({
    credentials: {
      provider: session.llm.provider,
      model: session.llm.model,
      verifiedAt: session.llm.verifiedAt,
    },
  });
}

/**
 * Probes the model and stores the credential.
 *
 * The probe is the gate: without it, a model that does not return structured
 * output would only be discovered at report-generation time, after the whole
 * GitHub fetch has been spent and the user is waiting for a PDF.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    provider?: unknown;
    apiKey?: unknown;
    model?: unknown;
  } | null;

  if (!body || !isLlmProvider(body.provider)) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }
  if (typeof body.apiKey !== "string" || body.apiKey.trim().length === 0) {
    return NextResponse.json({ error: "Enter a key." }, { status: 400 });
  }
  if (typeof body.model !== "string" || body.model.trim().length === 0) {
    return NextResponse.json({ error: "Pick a model." }, { status: 400 });
  }

  const apiKey = body.apiKey.trim();
  const model = body.model.trim();

  try {
    const supported = await probeStructuredOutputs(body.provider, apiKey, model);

    if (!supported) {
      return NextResponse.json(
        {
          error: CREDENTIAL_MESSAGES.no_structured_outputs,
          reason: "no_structured_outputs",
        },
        { status: 422 },
      );
    }
  } catch (error) {
    const reason = describeCredentialError(error);
    return NextResponse.json(
      { error: CREDENTIAL_MESSAGES[reason], reason },
      { status: reason === "unavailable" ? 502 : 400 },
    );
  }

  const verifiedAt = new Date().toISOString();
  session.llm = { provider: body.provider, apiKey, model, verifiedAt };
  await session.save();

  return NextResponse.json({
    credentials: { provider: body.provider, model, verifiedAt },
  });
}

/** Removes the credential from the session. With no database copy, this erases it. */
export async function DELETE() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  delete session.llm;
  await session.save();

  return NextResponse.json({ credentials: null });
}
