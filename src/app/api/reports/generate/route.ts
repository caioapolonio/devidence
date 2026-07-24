import { NextResponse, type NextRequest } from "next/server";

import { makeIdentity } from "@/lib/github/attribution";
import { fetchActivity } from "@/lib/github/activity";
import { createGitHubClient } from "@/lib/github/client";
import { clampDays, formatPeriodLabel, lastDays } from "@/lib/period";
import { buildEvidence } from "@/lib/report/builder";
import { generateReport } from "@/lib/report/generate";
import { getLlmCredentials, getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
// The GitHub fetch plus one model call can take a while on a busy repo; give it
// room. The period defaults small (30 days) to keep the common case well under.
export const maxDuration = 60;

/**
 * Generates a report, streaming progress as it goes.
 *
 * The fetch and the model call each take seconds, so the client gets `progress`
 * events (fetching, building, generating) and then either `done` with the draft
 * or `error` with a specific message. It's Server-Sent Events over a POST, so
 * the client reads the stream with fetch rather than EventSource.
 *
 * Identity is the logged-in login only. The OAuth scope doesn't guarantee the
 * user's email addresses, so email and co-author attribution are off here, and
 * the coverage note surfaces any commit that couldn't be tied to the account.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const llm = await getLlmCredentials();
  if (!llm) {
    return NextResponse.json(
      { error: "Add an API key in Settings before generating a report." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    owner?: unknown;
    repo?: unknown;
    days?: unknown;
    userContext?: unknown;
  } | null;

  if (
    !body ||
    typeof body.owner !== "string" ||
    typeof body.repo !== "string" ||
    typeof body.days !== "number"
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const owner = body.owner;
  const repo = body.repo;
  const days = clampDays(body.days);
  const userContext = typeof body.userContext === "string" ? body.userContext : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const period = lastDays(days);

        send("progress", { step: "fetching" });
        const client = createGitHubClient(user.accessToken);
        const identity = makeIdentity([user.login], []);
        const activity = await fetchActivity(client, { owner, repo, period, identity });

        send("progress", { step: "building" });
        const payload = buildEvidence(activity, { userContext });

        if (payload.evidence.length === 0) {
          send("error", {
            message:
              "No contribution of yours was found in this window. Try a longer period.",
          });
          return;
        }

        send("progress", {
          step: "generating",
          evidenceCount: payload.evidence.length,
        });
        const result = await generateReport({
          provider: llm.provider,
          apiKey: llm.apiKey,
          model: llm.model,
          payload,
          periodLabel: formatPeriodLabel(period),
        });

        if (!result.ok) {
          send("error", { message: result.message, reason: result.reason });
          return;
        }

        send("done", {
          draft: result.draft,
          evidence: payload.evidence.map((e) => ({
            id: e.id,
            kind: e.kind,
            title: e.title,
            sourceUrl: e.sourceUrl,
          })),
          excludedCount: payload.excludedCount,
          coverageNote: payload.coverageNote,
        });
      } catch (error) {
        // A GitHub 401 means the token was revoked mid-session.
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status: unknown }).status
            : null;
        send("error", {
          message:
            status === 401
              ? "Your GitHub authorization is no longer valid. Sign in again."
              : "Something went wrong while generating the report.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
