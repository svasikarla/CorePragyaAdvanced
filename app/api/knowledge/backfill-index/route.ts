import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { indexResearchReport } from "@/lib/research/index-report";
import { indexTechReport } from "@/lib/tech-research/index-report";
import { indexMvpDocuments } from "@/lib/mvp-docs/index-documents";
import { indexContentPieces } from "@/lib/content-creation/index-pieces";

export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Backfill the closed-loop index for the authenticated user's already-completed
// jobs. Idempotent (the index helper upserts by provenance), so safe to re-run.
// Bounded by `limit` per feature to stay within the function time budget — call
// repeatedly to work through a large backlog.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit: number = Math.min(body.limit ?? 5, 25);
  const includeContent: boolean = body.includeContent === true;

  const result: Record<string, { jobs: number; entries: number; errors: number }> = {};
  const errors: string[] = [];

  async function run(
    key: string,
    table: string,
    select: string,
    handle: (row: any) => Promise<number>
  ) {
    const stat = { jobs: 0, entries: 0, errors: 0 };
    const { data: rows, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .eq("user_id", user!.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) { errors.push(`${key}: ${error.message}`); result[key] = stat; return; }
    for (const row of rows ?? []) {
      try {
        const n = await handle(row);
        if (n > 0) { stat.jobs++; stat.entries += n; }
      } catch (e) {
        stat.errors++;
        errors.push(`${key}/${(row as any).id}: ${(e as Error).message}`);
      }
    }
    result[key] = stat;
  }

  await run("research", "research_jobs", "id, report", async (row) => {
    if (!row.report) return 0;
    await indexResearchReport(row.id, row.report, user!.id);
    return 1;
  });

  await run("tech_research", "tech_research_jobs", "id, report", async (row) => {
    if (!row.report) return 0;
    await indexTechReport(row.id, row.report, user!.id);
    return 1;
  });

  await run("mvp_docs", "mvp_docs_jobs", "id, config, documents", async (row) => {
    if (!row.documents?.length) return 0;
    return indexMvpDocuments(row.id, row.documents, row.config?.productName ?? "", user!.id);
  });

  if (includeContent) {
    await run("content", "content_creation_jobs", "id, config, content_pieces", async (row) => {
      if (!row.content_pieces?.length) return 0;
      return indexContentPieces(row.id, row.content_pieces, row.config?.topic ?? "", user!.id);
    });
  }

  const totalEntries = Object.values(result).reduce((s, r) => s + r.entries, 0);
  return NextResponse.json({
    success: true,
    limitPerFeature: limit,
    includeContent,
    totalEntries,
    perFeature: result,
    errors: errors.slice(0, 20),
  });
}
