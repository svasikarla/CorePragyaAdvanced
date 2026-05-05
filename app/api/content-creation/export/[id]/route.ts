import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { contentJobStore } from "@/lib/content-creation/store/job-store";
import { jobToMarkdown } from "@/lib/content-creation/export/markdown";
import { jobToHtml } from "@/lib/content-creation/export/html";
import type { Platform } from "@/types/content-creation";

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
  const platformParam = request.nextUrl.searchParams.get("platform");
  const platforms: Platform[] | undefined = platformParam
    ? (platformParam.split(",") as Platform[])
    : undefined;

  const job = await contentJobStore.get(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.user_id !== user.id) return new Response("Forbidden", { status: 403 });
  if (job.status !== "done" || !job.content_pieces?.length) {
    return NextResponse.json({ error: "Content not ready" }, { status: 409 });
  }

  const slug = job.config.topic.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (format === "html") {
    const html = jobToHtml(job, platforms);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.html"`,
      },
    });
  }

  const md = jobToMarkdown(job, platforms);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
    },
  });
}
