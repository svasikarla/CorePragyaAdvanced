import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { startContentCreationJob } from "@/lib/content-creation/agents/job-runner";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  topic: z.string().min(3).max(300),
  additionalContext: z.string().max(1000).default(""),
  targetPlatforms: z
    .array(z.enum(["medium", "linkedin_post", "linkedin_article", "blog", "twitter_thread", "substack", "devto"]))
    .min(1)
    .max(7),
  tone: z.enum(["professional", "casual", "technical", "educational", "conversational", "storytelling"]),
  targetAudience: z.string().max(200).default(""),
  keywords: z.string().max(300).default(""),
  includeCode: z.boolean().default(false),
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

    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(config.topic)) {
      return NextResponse.json({ error: "Invalid topic content" }, { status: 400 });
    }

    const jobId = await startContentCreationJob(config, user.id);
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Server busy") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
