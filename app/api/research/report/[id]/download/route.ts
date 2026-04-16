import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jobStore } from "@/lib/research/store/job-store";
import { reportToMarkdown } from "@/lib/research/export/markdown";
import { reportToHTML } from "@/lib/research/export/html";
import { reportToDocx } from "@/lib/research/export/docx-exporter";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const job = await jobStore.get(id);

  if (!job?.report) {
    return new NextResponse("Report not found", { status: 404 });
  }

  if (job.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const format = job.config.format;
  const slug = job.config.topic
    .slice(0, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `research-${slug}`;

  if (format === "md") {
    const content = reportToMarkdown(job.report);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  if (format === "html") {
    const content = await reportToHTML(job.report);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.html"`,
      },
    });
  }

  if (format === "docx") {
    const buffer = await reportToDocx(job.report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  }

  return new NextResponse("Unknown format", { status: 400 });
}
