import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mvpDocsJobStore } from "@/lib/mvp-docs/store/job-store";
import { jobToMarkdown } from "@/lib/mvp-docs/export/markdown";
import { jobToHtml } from "@/lib/mvp-docs/export/html";
import type { DocType } from "@/types/mvp-docs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authHeader = request.headers.get("authorization");
  const queryToken = request.nextUrl.searchParams.get("token");
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : queryToken;
  if (!rawToken) return new Response("Unauthorized", { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(rawToken);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const format = request.nextUrl.searchParams.get("format") ?? "md";
  const docParam = request.nextUrl.searchParams.get("doc");
  const docTypes: DocType[] | undefined = docParam
    ? (docParam.split(",") as DocType[])
    : undefined;

  const job = await mvpDocsJobStore.get(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.user_id !== user.id) return new Response("Forbidden", { status: 403 });
  if (job.status !== "done" || !job.documents?.length) {
    return NextResponse.json({ error: "Documents not ready" }, { status: 409 });
  }

  const base = (job.config.productName || "mvp-docs").slice(0, 40);
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mvp-docs";

  if (format === "html") {
    const html = jobToHtml(job, docTypes);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-docs.html"`,
      },
    });
  }

  const md = jobToMarkdown(job, docTypes);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-docs.md"`,
    },
  });
}
