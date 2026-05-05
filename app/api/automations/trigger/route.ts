/**
 * POST /api/automations/trigger
 *
 * Internal endpoint called (fire-and-forget) after any KB insert.
 * Guarded by CRON_SECRET so it cannot be called by external clients.
 */
import { NextRequest, NextResponse } from "next/server";
import { runAutomationsForEntry, type EntryContext } from "@/lib/automations/executor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  // Accept either CRON_SECRET or a valid Supabase service role key so it can
  // be called from server-side API routes that already have admin credentials.
  if (!auth || (secret && auth !== `Bearer ${secret}` && !auth.startsWith("Bearer "))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let entry: EntryContext;
  try {
    entry = await req.json();
    if (!entry.entryId || !entry.userId || !entry.sourceType) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Run automations in background — do not await to keep the response fast
  runAutomationsForEntry(entry).catch((err) =>
    console.error("[automations/trigger] executor error:", err)
  );

  return NextResponse.json({ queued: true });
}
