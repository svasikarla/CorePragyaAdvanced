/**
 * GET /api/cron/run-automations
 *
 * Vercel Cron job — runs every hour as a fallback for any KB entries whose
 * automation trigger was missed (e.g. if the process-url fire-and-forget
 * failed silently in a cold-start edge case).
 *
 * Checks entries created in the last 2 hours that haven't been through
 * automation processing, then runs matching automations.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAutomationsForEntry } from "@/lib/automations/executor";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find KB entries created in the last 2 hours that have NOT triggered automations
  // (i.e. no automation_run exists for them in this window)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: entries, error } = await supabaseAdmin
    .from("knowledgebase")
    .select("id, user_id, source_type, category, title, summary_text")
    .gte("created_at", twoHoursAgo)
    .not(
      "id",
      "in",
      // Exclude entries that already have a run logged
      supabaseAdmin
        .from("automation_runs")
        .select("trigger_kb_id")
        .gte("created_at", twoHoursAgo)
    );

  if (error) {
    console.error("[cron/run-automations] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = entries ?? [];
  let processed = 0;
  let failed = 0;

  for (const entry of items) {
    try {
      await runAutomationsForEntry({
        entryId: entry.id,
        userId: entry.user_id,
        sourceType: entry.source_type,
        category: entry.category ?? "Uncategorized",
        title: entry.title ?? "Untitled",
        summary: entry.summary_text ?? "",
      });
      processed++;
    } catch (err) {
      console.error("[cron/run-automations] entry", entry.id, "failed:", err);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed, total: items.length });
}
