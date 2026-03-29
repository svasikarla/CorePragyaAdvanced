import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
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

    const { data, error } = await supabaseAdmin
      .from('learning_progress')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      // Table may not exist yet — return empty
      return NextResponse.json({ progress: {} })
    }

    const progress: Record<string, object> = {}
    for (const row of data || []) {
      progress[row.entry_id] = {
        flashcardsGenerated: row.flashcards_generated,
        conceptMapCreated: row.concept_map_created,
        questionsAsked: row.questions_asked,
        lastStudied: row.last_studied,
        completionPercentage: row.completion_percentage,
      }
    }

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Error fetching learning progress:', error)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

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

    const { entryId, flashcardsGenerated, conceptMapCreated, questionsAsked, completionPercentage } = await request.json()
    if (!entryId) {
      return NextResponse.json({ error: 'entryId required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('learning_progress')
      .upsert({
        user_id: user.id,
        entry_id: entryId,
        flashcards_generated: flashcardsGenerated ?? false,
        concept_map_created: conceptMapCreated ?? false,
        questions_asked: questionsAsked ?? 0,
        completion_percentage: completionPercentage ?? 0,
        last_studied: new Date().toISOString(),
      }, { onConflict: 'user_id,entry_id' })

    if (error) {
      console.error('Error saving progress:', error)
      // Don't fail — progress tracking is non-critical
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving learning progress:', error)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
