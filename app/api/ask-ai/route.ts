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

    const { entryId, question } = await request.json()
    if (!entryId || !question?.trim()) {
      return NextResponse.json({ error: 'entryId and question are required' }, { status: 400 })
    }

    const { data: entry, error: dbError } = await supabaseAdmin
      .from('knowledgebase')
      .select('id, title, summary_text, summary_json, category, source_ref')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single()

    if (dbError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const keyPoints = entry.summary_json?.key_points?.join('\n- ') || ''
    const context = [
      `Title: ${entry.title || 'Untitled'}`,
      `Category: ${entry.category || 'General'}`,
      `Summary: ${entry.summary_text || ''}`,
      keyPoints ? `Key Points:\n- ${keyPoints}` : '',
    ].filter(Boolean).join('\n\n')

    const llm = getLLMProvider()
    const response = await llm.createCompletion({
      model: 'claude-sonnet-4-6',
      messages: [
        {
          role: 'user',
          content: `You are a knowledgeable assistant helping a user understand content from their personal knowledge base.

Here is the knowledge base entry:
${context}

User question: ${question}

Answer the question based on the content above. Be concise and accurate. If the answer cannot be determined from the content, say so clearly and provide general knowledge if helpful.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    return NextResponse.json({
      answer: response.content,
      entryId,
      question,
    })
  } catch (error) {
    console.error('Error in ask-ai:', error)
    return NextResponse.json({ error: 'Failed to get AI answer' }, { status: 500 })
  }
}
