import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refinePrompt } from "@/lib/prompt-refiner/refine";
import { historyStore } from "@/lib/prompt-refiner/history-store";
import type { RefineContext } from "@/types/prompt-refiner";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_PROMPT_LENGTH = 8000;

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const prompt: string = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const rawContext = (body?.context ?? {}) as RefineContext;
    const context: RefineContext = {
      role: typeof rawContext.role === "string" ? rawContext.role : undefined,
      outputFormat:
        typeof rawContext.outputFormat === "string" ? rawContext.outputFormat : undefined,
      audience: typeof rawContext.audience === "string" ? rawContext.audience : undefined,
      targetModel:
        typeof rawContext.targetModel === "string" ? rawContext.targetModel : undefined,
    };

    const { variants, model } = await refinePrompt(prompt, context);

    const entry = await historyStore.create({
      userId: user.id,
      originalPrompt: prompt,
      context,
      variants,
      model,
    });

    return NextResponse.json({ id: entry.id, variants });
  } catch (error) {
    console.error("Error in prompt-refiner:", error);
    const message = error instanceof Error ? error.message : "Failed to refine prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
