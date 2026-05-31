import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { startMvpDocsJob } from "@/lib/mvp-docs/agents/job-runner";
import { ALL_DOC_TYPES } from "@/types/mvp-docs";
import type { DocType } from "@/types/mvp-docs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  productBrief: z.string().min(20).max(4000),
  additionalContext: z.string().max(1500).default(""),
  productName: z.string().max(120).default(""),
  targetDocs: z
    .array(z.enum(ALL_DOC_TYPES as [DocType, ...DocType[]]))
    .min(1)
    .max(ALL_DOC_TYPES.length),
  targetAudience: z.string().max(200).default(""),
  searchMyKB: z.boolean().default(false),
  provider: z.enum(["anthropic", "openai", "groq"]),
  model: z.string().min(1),
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

    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(config.productBrief)) {
      return NextResponse.json({ error: "Invalid brief content" }, { status: 400 });
    }

    const jobId = await startMvpDocsJob(config, user.id);
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Server busy") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
