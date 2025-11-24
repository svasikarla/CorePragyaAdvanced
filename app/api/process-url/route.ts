import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLLMProvider, getModelForProvider } from '@/lib/ai-clients';

// Create a Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Simple function to extract text content from HTML
 * This helps reduce token usage by removing HTML tags and scripts
 */
function extractTextFromHtml(html: string): string {
  try {
    // Remove script and style tags and their content
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    // Remove all HTML tags
    text = text.replace(/<[^>]*>/g, ' ');

    // Replace multiple spaces, newlines, and tabs with a single space
    text = text.replace(/\s+/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");

    return text.trim();
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return html.substring(0, 15000); // Fallback to truncated HTML
  }
}

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the URL from the request body
    let url;
    try {
      const body = await request.json();
      url = body.url;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url); // This will throw if the URL is invalid
    } catch (urlError) {
      console.error('Invalid URL format:', urlError);
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch content from the URL with timeout and error handling
    let htmlContent;
    let title = 'Untitled Page'; // Declare title at a higher scope with default value
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json({
          error: `Failed to fetch URL content: ${response.status} ${response.statusText}`
        }, { status: 400 });
      }

      htmlContent = await response.text();

      if (!htmlContent || htmlContent.trim().length === 0) {
        return NextResponse.json({ error: 'Empty content from URL' }, { status: 400 });
      }

      // Extract title from HTML
      const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname || 'Untitled Page'; // Assign to the higher-scoped variable
    } catch (error) {
      const fetchError = error as Error;
      console.error('Error fetching URL:', fetchError);
      return NextResponse.json({
        error: `Failed to fetch URL: ${fetchError.message || 'Unknown error'}`
      }, { status: 400 });
    }

    // Process the content with LLM provider
    let aiContent;
    try {
      // Extract text from HTML to reduce token usage
      const textContent = extractTextFromHtml(htmlContent);

      // Limit the text content to avoid token limit issues
      const truncatedText = textContent.substring(0, 15000); // Limit to ~15K characters

      const llmProvider = getLLMProvider();
      const modelName = getModelForProvider('claude-3-haiku');

      const aiResponse = await llmProvider.createCompletion({
        model: modelName,
        system: `You are an AI assistant that extracts, categorizes, and summarizes content from web pages.
        Extract the main content from the text, ignoring navigation, ads, footers, etc.
        Then provide a concise summary of the content and categorize it into one of the following categories:
        - Science
        - Technology
        - Artificial Intelligence
        - Business
        - Health
        - Education
        - Politics
        - Environment
        - Arts
        - Sports
        - Other

        Choose the most appropriate category based on the content.

        IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text.

        Return a JSON object with exactly this structure:
        {
          "raw_text": "A cleaned version of the main textual content (max 1000 words)",
          "summary_text": "A concise summary of the content (max 250 words)",
          "summary_json": {
            "key_points": ["point 1", "point 2", "point 3"],
            "main_ideas": ["idea 1", "idea 2"],
            "insights": ["insight 1", "insight 2"]
          },
          "category": "One of the predefined categories"
        }`,
        messages: [
          {
            role: "user",
            content: `Process this text content from ${url}:

            Text content: ${truncatedText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      if (!aiResponse.content) {
        console.error('Invalid AI response:', aiResponse);
        return NextResponse.json({ error: 'Failed to process content with AI' }, { status: 500 });
      }

      // Parse the AI response
      try {
        let contentToParse = aiResponse.content;

        // Try to extract JSON from markdown code blocks if present
        const jsonBlockMatch = contentToParse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonBlockMatch) {
          contentToParse = jsonBlockMatch[1];
        } else {
          // Try to find JSON object in the response
          const jsonMatch = contentToParse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            contentToParse = jsonMatch[0];
          }
        }

        aiContent = JSON.parse(contentToParse);

        // Validate the AI response structure
        if (!aiContent.raw_text || !aiContent.summary_text || !aiContent.summary_json || !aiContent.category) {
          console.error('Invalid AI content structure:', aiContent);
          return NextResponse.json({ error: 'AI returned invalid content structure' }, { status: 500 });
        }

        // Validate the category
        const validCategories = [
          'Science', 'Technology', 'Artificial Intelligence', 'Business',
          'Health', 'Education', 'Politics', 'Environment', 'Arts', 'Sports', 'Other'
        ];

        if (!validCategories.includes(aiContent.category)) {
          console.warn('Invalid category, defaulting to "Other":', aiContent.category);
          aiContent.category = 'Other';
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('AI response content:', aiResponse.content);
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }
    } catch (error) {
      const aiError = error as Error;
      console.error('LLM API error:', aiError);
      return NextResponse.json({
        error: `AI processing error: ${aiError.message || 'Unknown error'}`
      }, { status: 500 });
    }

    // Check if the knowledgebase table exists by querying its structure
    try {
      const { error: tableError } = await supabaseAdmin
        .from('knowledgebase')
        .select('id')
        .limit(1);

      if (tableError && tableError.code === '42P01') { // PostgreSQL code for undefined_table
        console.error('Knowledgebase table does not exist:', tableError);

        // Try to create the table on the fly
        try {
          const createTableSQL = `
            -- Create knowledgebase table
            CREATE TABLE IF NOT EXISTS knowledgebase (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL,
              source_type TEXT NOT NULL,
              source_ref TEXT NOT NULL,
              raw_text TEXT NOT NULL,
              summary_text TEXT NOT NULL,
              summary_json JSONB NOT NULL,
              category TEXT NOT NULL DEFAULT 'Uncategorized',
              title TEXT NOT NULL DEFAULT '',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Add indexes
            CREATE INDEX IF NOT EXISTS knowledgebase_user_id_idx ON knowledgebase (user_id);
            CREATE INDEX IF NOT EXISTS knowledgebase_created_at_idx ON knowledgebase (created_at);
            CREATE INDEX IF NOT EXISTS knowledgebase_category_idx ON knowledgebase (category);
          `;

          // Use the raw query method instead of sql
          const { error: createError } = await supabaseAdmin.rpc('execute_sql', { sql: createTableSQL });

          if (createError) {
            console.error('Failed to create knowledgebase table:', createError);
            return NextResponse.json({ error: 'Failed to create database table' }, { status: 500 });
          }

          console.log('Successfully created knowledgebase table');
        } catch (createError) {
          console.error('Error creating knowledgebase table:', createError);
          return NextResponse.json({ error: 'Failed to create database table' }, { status: 500 });
        }
      }
    } catch (tableCheckError) {
      console.error('Error checking table existence:', tableCheckError);
    }

    // Insert the data into Supabase
    try {
      // Ensure summary_json is an object, not a string
      let summaryJsonData = aiContent.summary_json;
      if (typeof summaryJsonData === 'string') {
        try {
          summaryJsonData = JSON.parse(summaryJsonData);
        } catch (e) {
          console.error('Error parsing summary_json string:', e);
          summaryJsonData = {
            key_points: [],
            main_ideas: [],
            insights: []
          };
        }
      }

      const { data, error } = await supabaseAdmin
        .from('knowledgebase')
        .insert({
          user_id: user.id,
          source_type: 'url',
          source_ref: url,
          raw_text: aiContent.raw_text,
          summary_text: aiContent.summary_text,
          summary_json: summaryJsonData, // Use the parsed or original object
          category: aiContent.category,
          title: title // Add the extracted title
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({
          error: `Database error: ${error.message || 'Failed to save to database'}`
        }, { status: 500 });
      }

      if (!data) {
        console.error('No data returned from insert');
        return NextResponse.json({ error: 'No data returned from database' }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    } catch (error) {
      const dbError = error as Error;
      console.error('Database operation error:', dbError);
      return NextResponse.json({
        error: `Database operation failed: ${dbError.message || 'Unknown error'}`
      }, { status: 500 });
    }

  } catch (err) {
    const error = err as Error;
    console.error('Unhandled error processing URL:', error);
    return NextResponse.json({
      error: `Internal server error: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}
