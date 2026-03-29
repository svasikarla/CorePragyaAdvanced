import { SupabaseClient } from '@supabase/supabase-js';

// The signature explicitly requires injected clients, making it perfectly mockable for testing
export async function detectKnowledgeDecay(supabase: SupabaseClient, anthropic: any) {
  console.log("Running knowledge decay detector...");

  try {
    // 1. Fetch newly ingested news (e.g., from the last 2 hours)
    const recentNewsTime = new Date();
    recentNewsTime.setHours(recentNewsTime.getHours() - 2);

    const { data: newNews, error: newsErr } = await supabase
      .from('knowledgebase')
      .select('id, raw_text, created_at, user_id')
      .eq('source_type', 'rss')
      .gte('created_at', recentNewsTime.toISOString());

    if (newsErr || !newNews || newNews.length === 0) {
      console.log("No recent news to analyze for decay.");
      return { status: 'no_news' };
    }

    let contradictionsFound = 0;

    // 2. We need to fetch the embedding for the new news to find related old knowledge
    for (const news of newNews) {
      const { data: newsEmbs } = await supabase
        .from('embeddings')
        .select('embedding')
        .eq('knowledge_base_id', news.id)
        .limit(1);

      if (newsEmbs && newsEmbs.length > 0) {
        const { data: matches, error: rpcErr } = await supabase.rpc('match_embeddings', {
          query_embedding: newsEmbs[0].embedding,
          match_threshold: 0.75,
          match_count: 5
        });
        
        if (rpcErr || !matches) continue;
        
        // Filter out matches that are the new node itself or extremely recent
        const olderMatches = matches.filter((m: any) => m.knowledge_base_id !== news.id);

        for (const match of olderMatches) {
          // Fetch the old raw_text
          const { data: oldKb } = await supabase
            .from('knowledgebase')
            .select('raw_text, id')
            .eq('id', match.knowledge_base_id)
            .single();

          if (oldKb && oldKb.raw_text) {
             const prompt = `You are a fact checker. Does the "New Recent News" directly CONTRADICT the factual information in the "Old Knowledge Snippet"? Or does it state that the old knowledge is outdated?
Reply ONLY with "YES" if it contradicts/outdates it, and "NO" if they agree, talk about different things, or elaborate on each other.

Old Knowledge Snippet:
${oldKb.raw_text}

New Recent News:
${news.raw_text}`;

             const message = await anthropic.messages.create({
                model: "claude-3-haiku-20240307",
                max_tokens: 30,
                temperature: 0,
                messages: [{ role: "user", content: prompt }]
             });

             const text = message.content[0].type === 'text' ? message.content[0].text : '';
             
             if (text.includes("YES")) {
                console.log(`Alert! Contradiction found. Old ID: ${oldKb.id}, New ID: ${news.id}`);
                contradictionsFound++;
                
                // 3. Document the contradiction in the database
                await supabase.from('proactive_alerts').insert({
                   user_id: news.user_id,
                   type: 'contradiction',
                   description: "New ingested news seems to outdate or contradict this knowledge.",
                   source_node_id: oldKb.id,
                   new_news_id: news.id,
                   resolved_status: 'pending'
                });
             }
          }
        }
      }
    }
    console.log("Detector finished.");
    return { status: 'success', contradictions: contradictionsFound };
  } catch (err) {
    console.error("Decay detector error:", err);
    return { status: 'error', error: err };
  }
}
