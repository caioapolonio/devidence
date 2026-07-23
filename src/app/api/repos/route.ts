import { NextResponse } from "next/server";

import { createGitHubClient, listRepositories } from "@/lib/github/client";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  try {
    const repositories = await listRepositories(
      createGitHubClient(user.accessToken),
    );
    return NextResponse.json({ repositories });
  } catch (error) {
    // A token revoked on GitHub still looks valid to us until the first call
    // fails. A 401 here tells the client to log in again instead of showing an
    // "unknown error".
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 401
    ) {
      return NextResponse.json(
        { error: "Your GitHub authorization is no longer valid. Sign in again." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Could not list your repositories." },
      { status: 502 },
    );
  }
}
