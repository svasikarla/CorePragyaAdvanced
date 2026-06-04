import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { startTechResearchJob } from "@/lib/tech-research/agents/job-runner";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const criteriaSchema = z.object({
  performance: z.number().min(1).max(5),
  developer_experience: z.number().min(1).max(5),
  maturity: z.number().min(1).max(5),
  cost: z.number().min(1).max(5),
  security: z.number().min(1).max(5),
});

const schema = z.object({
  requirement: z.string().min(10).max(1000),
  current_stack: z.string().max(500).default(""),
  constraints: z.string().max(500).default(""),
  criteria: criteriaSchema,
  provider: z.enum(["anthropic", "openai", "groq"]),
  model: z.string().min(1),
  depth: z.enum(["tier1", "tier2", "tier3"]),
  format: z.enum(["md", "html", "docx"]),
  focus_area: z.enum([
    "frontend",
    "backend",
    "database",
    "infrastructure",
    "security",
    "mobile",
    "ai_ml",
    "general",
  ]),
  searchMyKB: z.boolean().optional().default(false),
  indexToKB: z.boolean().optional().default(true),
});

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
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(config.requirement)) {
      return NextResponse.json({ error: "Invalid requirement content" }, { status: 400 });
    }

    const jobId = await startTechResearchJob(config, user.id);
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Server busy") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
