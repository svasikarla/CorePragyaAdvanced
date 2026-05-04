import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { techJobStore } from "@/lib/tech-research/store/job-store";
import { techReportToMarkdown } from "@/lib/tech-research/export/markdown";
import { techReportToHTML } from "@/lib/tech-research/export/html";
import { techReportToDocx } from "@/lib/tech-research/export/docx-exporter";

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
  if (!rawToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(rawToken);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await techJobStore.get(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!job.report) return NextResponse.json({ error: "Report not ready" }, { status: 404 });

  const format = request.nextUrl.searchParams.get("format") ?? job.config.format ?? "md";
  const slug = job.config.requirement
    .slice(0, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (format === "md") {
    const content = techReportToMarkdown(job.report);
    return new Response(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="tech-research-${slug}.md"`,
      },
    });
  }

  if (format === "html") {
    const content = await techReportToHTML(job.report);
    return new Response(content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="tech-research-${slug}.html"`,
      },
    });
  }

  if (format === "docx") {
    const buffer = await techReportToDocx(job.report);
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="tech-research-${slug}.docx"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 });
}
