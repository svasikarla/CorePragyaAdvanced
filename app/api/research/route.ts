import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { startResearchJob } from "@/lib/research/agents/job-runner";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  topic: z.string().min(3).max(500),
  provider: z.enum(["anthropic", "openai", "groq"]),
  model: z.string().min(1),
  depth: z.enum(["tier1", "tier2", "tier3"]),
  audience: z.enum(["executive", "technical", "analyst", "client", "board"]),
  format: z.enum(["md", "html", "docx"]),
  searchMyKB: z.boolean().optional().default(false),
  indexToKB: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const config = result.data;

    // Basic prompt injection guard
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(config.topic)) {
      return NextResponse.json({ error: "Invalid topic content" }, { status: 400 });
    }

    const jobId = await startResearchJob(config, user.id);
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Server busy") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
