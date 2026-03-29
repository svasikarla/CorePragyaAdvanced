import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLLMProvider } from '@/lib/ai-clients'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId, bulk, entryIds } = await request.json()

    // Determine which entries to fetch
    let query = supabaseAdmin
      .from('knowledgebase')
      .select('id, title, summary_text, summary_json, category')
      .eq('user_id', user.id)

    if (bulk && entryIds?.length) {
      query = query.in('id', entryIds)
    } else if (entryId) {
      query = query.eq('id', entryId)
    } else {
      return NextResponse.json({ error: 'entryId or entryIds required' }, { status: 400 })
    }

    const { data: entries, error: dbError } = await query
    if (dbError || !entries?.length) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const llm = getLLMProvider()
    const allFlashcards: Record<string, { question: string; answer: string }[]> = {}

    for (const entry of entries) {
      const keyPoints = entry.summary_json?.key_points?.join('\n') || ''
      const content = [entry.summary_text, keyPoints].filter(Boolean).join('\n')

      const prompt = `You are a study assistant. Generate 5 flashcards from the following knowledge base entry.

Title: ${entry.title || 'Untitled'}
Category: ${entry.category || 'General'}
Content: ${content}

Return a JSON array of exactly 5 objects with "question" and "answer" fields. Questions should test understanding, not just recall. Keep answers concise (1-2 sentences).

Example format:
[{"question": "What is X?", "answer": "X is ..."}]

Return only the JSON array, no other text.`

      const response = await llm.createCompletion({
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      })

      try {
        const text = response.content.trim()
        const jsonStr = text.startsWith('[') ? text : text.slice(text.indexOf('['))
        allFlashcards[entry.id] = JSON.parse(jsonStr)
      } catch {
        allFlashcards[entry.id] = [
          { question: `What is the main topic of "${entry.title}"?`, answer: entry.summary_text?.slice(0, 150) || 'See full entry.' }
        ]
      }
    }

    return NextResponse.json({ flashcards: allFlashcards })
  } catch (error) {
    console.error('Error generating flashcards:', error)
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 })
  }
}
