import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchUnreadEmails, markEmailAsRead } from '@/lib/email/emailService';

// Create a Supabase client with admin privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Process a URL and store the result in the knowledgebase
 * This reuses the existing URL processing logic but adapts it for email sources
 */
async function processAndStoreUrl(url: string, userId: string, emailSubject: string) {
  try {
    // Validate URL format
    try {
      // Add http:// prefix if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      new URL(url); // This will throw if the URL is invalid
    } catch (urlError) {
      console.error('Invalid URL format:', urlError);
      return { success: false, error: 'Invalid URL format' };
    }

    // Fetch content from the URL
    let htmlContent;
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
        return {
          success: false,
          error: `Failed to fetch URL content: ${response.status} ${response.statusText}`
        };
      }

      htmlContent = await response.text();

      if (!htmlContent || htmlContent.trim().length === 0) {
        return { success: false, error: 'Empty content from URL' };
      }
    } catch (error) {
      const fetchError = error as Error;
      console.error('Error fetching URL:', fetchError);
      return {
        success: false,
        error: `Failed to fetch URL: ${fetchError.message || 'Unknown error'}`
      };
    }

    // Extract text from HTML to reduce token usage
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

    const extractedText = extractTextFromHtml(htmlContent);

    // Extract title from HTML
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : emailSubject || 'Untitled Page';

    // Import LLM provider
    const { getLLMProvider, getModelForProvider } = await import('@/lib/ai-clients');

    const prompt = `
      Article Title: ${title}

      Article Content: ${extractedText.substring(0, 15000)}

      Please analyze this content and provide:
      1. A concise summary (max 150 words)
      2. 3-5 key points from the article
      3. 2-3 main ideas
      4. 1-2 insights or takeaways
      5. A category that best fits this content from the following options:
         - Artificial Intelligence
         - Science
         - Technology
         - Business
         - Education
         - Health
         - Personal Development
         - Other (please specify)

      Format your response as JSON with the following structure:
      {
        "summary_text": "concise summary here",
        "summary_json": {
          "key_points": ["point 1", "point 2", ...],
          "main_ideas": ["idea 1", "idea 2", ...],
          "insights": ["insight 1", "insight 2", ...]
        },
        "category": "category name"
      }
    `;

    const llmProvider = getLLMProvider();
    const modelName = getModelForProvider('claude-3-haiku');

    const aiResponse = await llmProvider.createCompletion({
      model: modelName,
      system: "You are a helpful assistant that summarizes web content accurately and concisely.",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const aiContent = aiResponse.content || '';

    // Parse the AI response
    let parsedContent;
    try {
      // Extract JSON from the response (in case there's any extra text)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiContent;

      try {
        // First try standard JSON parsing
        parsedContent = JSON.parse(jsonString);
      } catch (initialParseError) {
        console.log('Initial JSON parsing failed, attempting to fix malformed JSON...');

        // Try to fix common JSON formatting issues
        let fixedJsonString = jsonString
          // Replace single quotes with double quotes (but not inside already quoted strings)
          .replace(/([{,]\s*)(')?([a-zA-Z0-9_]+)(')?(\s*:)/g, '$1"$3"$5')
          // Replace single-quoted values with double-quoted values
          .replace(/:\s*'([^']*)'/g, ': "$1"')
          // Remove trailing commas in objects and arrays
          .replace(/,(\s*[}\]])/g, '$1');

        try {
          parsedContent = JSON.parse(fixedJsonString);
        } catch (fixedParseError) {
          // If all else fails, create a structured response from the text
          console.error('Failed to parse fixed JSON:', fixedParseError);
          throw new Error('Unable to parse response after fixes');
        }
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Create a fallback structure
      parsedContent = {
        summary_text: aiContent.substring(0, 500) || "Failed to generate summary.",
        summary_json: {
          key_points: [],
          main_ideas: [],
          insights: []
        },
        category: 'Other'
      };
    }

    // Ensure summary_json is an object, not a string
    let summaryJsonData = parsedContent.summary_json;
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

    // Insert the data into Supabase
    const { data, error } = await supabaseAdmin
      .from('knowledgebase')
      .insert({
        user_id: userId,
        source_type: 'email',
        source_ref: url,
        raw_text: extractedText.substring(0, 15000),
        summary_text: parsedContent.summary_text || '',
        summary_json: summaryJsonData,
        category: parsedContent.category || 'Other',
        title: title
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return {
        success: false,
        error: `Database error: ${error.message || 'Failed to save to database'}`
      };
    }

    return { success: true, data };
  } catch (err) {
    const error = err as Error;
    console.error('Unhandled error processing URL:', error);
    return {
      success: false,
      error: `Internal server error: ${error.message || 'Unknown error'}`
    };
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

    console.log(`Processing emails for user: ${user.email}`);

    // Fetch unread emails sent by the logged-in user
    let emails;
    try {
      emails = await fetchUnreadEmails(20, user.email); // Limit to 20 emails and filter by user email
    } catch (error) {
      console.error('Error fetching emails:', error);

      // Return specific error messages for OAuth issues
      if (error.message.includes('authenticate') || error.message.includes('expired')) {
        return NextResponse.json({
          error: error.message,
          authRequired: true,
          setupUrl: '/setup/gmail'
        }, { status: 401 });
      }

      return NextResponse.json({
        error: 'Failed to fetch emails: ' + error.message
      }, { status: 500 });
    }

    if (emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new emails to process from your account',
        processed: 0,
        errors: 0
      });
    }

    // Process each email
    let processed = 0;
    let errors = 0;
    const results = [];

    for (const email of emails) {
      // Process each URL found in the email
      for (const url of email.urls) {
        try {
          const result = await processAndStoreUrl(url, email.userId!, email.subject);

          if (result.success) {
            processed++;
            results.push({
              url,
              success: true,
              title: result.data?.title || 'Unknown'
            });
          } else {
            errors++;
            results.push({
              url,
              success: false,
              error: result.error
            });
          }
        } catch (error) {
          console.error(`Error processing URL ${url}:`, error);
          errors++;
          results.push({
            url,
            success: false,
            error: 'Unexpected error during processing'
          });
        }
      }

      // Mark email as read regardless of processing success
      await markEmailAsRead(email.messageId);
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} URLs from ${emails.length} emails`,
      processed,
      errors,
      results
    });

  } catch (err) {
    const error = err as Error;
    console.error('Unhandled error in email refresh:', error);
    return NextResponse.json({
      success: false,
      error: `Internal server error: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}
