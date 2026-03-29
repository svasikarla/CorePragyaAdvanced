import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateDailyDigest() {
  console.log("Starting daily digest generation...");

  try {
    // 1. Fetch nodes added in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: newKnowledge, error } = await supabase
      .from('knowledgebase')
      .select('id, summary_text, raw_text, source_type, created_at')
      .gte('created_at', yesterday.toISOString());

    if (error) {
      console.error("Failed to fetch new knowledge:", error);
      return;
    }

    if (!newKnowledge || newKnowledge.length === 0) {
      console.log("No new knowledge added in the last 24 hours.");
      return;
    }

    console.log(`Found ${newKnowledge.length} new knowledge pieces. Compiling digest...`);

    // 2. Compile text for the LLM
    const itemsText = newKnowledge.map(k => `Source: ${k.source_type}\nSummary: ${k.summary_text}\nContent Snippet: ${k.raw_text.substring(0, 300)}...`).join('\n\n');

    // 3. Ask Claude to generate a summary
    const prompt = `You are a knowledge management assistant. Below are snippets of knowledge added to our system in the past 24 hours.
Please generate a single cohesive "Daily Insights Digest" summarizing the key themes and happenings. Format it nicely in Markdown.

New Knowledge Additions:
${itemsText}`;

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      temperature: 0.5,
      messages: [
        { role: "user", content: prompt }
      ]
    });

    const digest = message.content[0].type === 'text' ? message.content[0].text : 'No text generated.';
    console.log("================ DAILY DIGEST ================\n");
    console.log(digest);
    console.log("\n==============================================");

    // In a prod environment, you would loop through user_subscriptions and email this digest
    // e.g. using Resend, Sendgrid, or Gmail API.
    console.log("Digest successfully generated. (Email integration pending).");

  } catch (err) {
    console.error("Error generating digest:", err);
  }
}

generateDailyDigest();
