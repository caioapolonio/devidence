import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Ends the session.
 *
 * Because the GitHub token only exists inside the cookie, destroying the session
 * actually erases the token: there is no database copy to revoke afterwards.
 *
 * It's POST on purpose: logout over GET is triggerable by a third party's
 * `<img src>`.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
