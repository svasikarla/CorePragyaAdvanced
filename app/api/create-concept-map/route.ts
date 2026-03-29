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

    const { entryId } = await request.json()
    if (!entryId) {
      return NextResponse.json({ error: 'entryId required' }, { status: 400 })
    }

    const { data: entry, error: dbError } = await supabaseAdmin
      .from('knowledgebase')
      .select('id, title, summary_text, summary_json, category')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single()

    if (dbError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const keyPoints = entry.summary_json?.key_points?.join('\n') || ''
    const content = [entry.summary_text, keyPoints].filter(Boolean).join('\n')

    const llm = getLLMProvider()
    const prompt = `You are a knowledge mapping assistant. Analyze the following content and extract a concept map.

Title: ${entry.title || 'Untitled'}
Category: ${entry.category || 'General'}
Content: ${content}

Return a JSON object with:
- "centralConcept": the main topic (string)
- "nodes": array of concept objects, each with "id" (string), "label" (string), "description" (1 sentence)
- "edges": array of relationship objects, each with "from" (node id), "to" (node id), "label" (relationship type, e.g. "leads to", "is part of", "depends on")

Generate 5-8 nodes and 5-10 edges that capture the key relationships in the content.

Return only the JSON object, no other text.`

    const response = await llm.createCompletion({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1200,
    })

    try {
      const text = response.content.trim()
      const jsonStr = text.startsWith('{') ? text : text.slice(text.indexOf('{'))
      const conceptMap = JSON.parse(jsonStr)
      return NextResponse.json({ conceptMap, entryId })
    } catch {
      return NextResponse.json({
        conceptMap: {
          centralConcept: entry.title || 'Main Concept',
          nodes: [
            { id: 'main', label: entry.title || 'Main Concept', description: entry.summary_text?.slice(0, 100) || '' }
          ],
          edges: []
        },
        entryId
      })
    }
  } catch (error) {
    console.error('Error creating concept map:', error)
    return NextResponse.json({ error: 'Failed to create concept map' }, { status: 500 })
  }
}
