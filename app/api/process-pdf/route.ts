import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { createRateLimiter, recordTokenUsage } from '@/lib/rate-limiting';
import { parsePdf } from '@/lib/pdf-parser';
import { anthropic } from '@/lib/ai-clients';

// Create a Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Next.js App Router doesn't need this config
// The formData() method will handle multipart/form-data automatically

/**
 * Extract text from a PDF buffer
 * Extracts only the first page to reduce token usage
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    // Verify it's actually a PDF
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || fileType.mime !== 'application/pdf') {
      throw new Error('Uploaded file is not a valid PDF');
    }

    // Extract only the first page
    const pdfData = await parsePdf(buffer, { firstPageOnly: true });

    // Check if the PDF has any pages
    if (pdfData.numpages === 0) {
      throw new Error('The PDF document has no pages');
    }

    // If text is empty but the PDF has pages, it might be a scanned document
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return {
        text: "This appears to be a scanned document or image-based PDF with no extractable text.",
        pageCount: pdfData.numpages
      };
    }

    return {
      text: pdfData.text,
      pageCount: pdfData.numpages
    };
  } catch (error) {
    console.error('Error processing PDF file:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  // Track token usage
  let inputTokens = 0;
  let outputTokens = 0;
  let pageCount = 1; // Default page count

  try {
    console.log('PDF processing started');

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

    // Check rate limits
    const { isLimited } = createRateLimiter(user.id, '/api/process-pdf');
    if (isLimited) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    // Create a temporary directory
    const uploadDir = join(process.cwd(), 'tmp');
    await fs.mkdir(uploadDir, { recursive: true }).catch(err => {
      console.error('Error creating tmp directory:', err);
      // Continue even if directory exists
    });

    // Process the uploaded file
    let fileName, category;
    let pdfBuffer: Buffer;

    try {
      console.log('Parsing form data');

      // Parse the form data using Next.js native method
      const formData = await request.formData();
      const file = formData.get('file');
      category = formData.get('category')?.toString() || 'Documents';

      console.log('Form data parsed:', {
        hasFile: !!file,
        fileType: file ? typeof file : 'none',
        category
      });

      if (!file || !(file instanceof File)) {
        console.error('No valid file in request');
        return NextResponse.json({ error: 'No valid file uploaded' }, { status: 400 });
      }

      fileName = file.name || 'document.pdf';
      console.log('Received file:', fileName, 'Size:', file.size);

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('File upload error:', error);
      return NextResponse.json({
        error: 'File upload failed',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 400 });
    }

    // Extract text from PDF
    let pdfText;
    try {
      console.log('Extracting text from PDF');
      const extractionResult = await extractPdfText(pdfBuffer);
      pdfText = extractionResult.text;
      pageCount = extractionResult.pageCount; // Store the page count

      if (!pdfText || pdfText.trim().length === 0) {
        return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
      }

      console.log('PDF text extracted, length:', pdfText.length, 'pages:', pageCount);
    } catch (error) {
      console.error('PDF processing error:', error);
      return NextResponse.json({
        error: 'Failed to process PDF file',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 400 });
    }

    // Truncate text if it's too long (to avoid token limits)
    const maxTextLength = 15000;
    const truncatedText = pdfText.length > maxTextLength
      ? pdfText.substring(0, maxTextLength) + '... [Content truncated due to length]'
      : pdfText;

    // Process with Anthropic Claude
    let aiContent;
    try {
      const completion = await anthropic.messages.create({
        model: 'claude-3-5-sonnet',
        system: `You are an AI assistant that extracts key information from documents.
          Analyze the following PDF document content (first page only) and provide:
          1. A concise summary (1-2 paragraphs)
          2. Key points as bullet points
          3. Main ideas as bullet points
          4. Insights or implications as bullet points
          5. A category that best describes this document

          Note that you are only seeing the first page of the document, so focus on extracting
          the most important information available and indicate if the content appears to continue.

          Format your response as a JSON object with the following structure:
          {
            "summary_text": "Your concise summary here",
            "summary_json": {
              "key_points": ["Point 1", "Point 2", ...],
              "main_ideas": ["Idea 1", "Idea 2", ...],
              "insights": ["Insight 1", "Insight 2", ...]
            },
            "category": "The category you assigned"
          }

          DO NOT include the original text in your response.`,
        messages: [
          {
            role: 'user',
            content: truncatedText
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      // Track token usage
      inputTokens = completion.usage?.prompt_tokens || 0;
      outputTokens = completion.usage?.completion_tokens || 0;

      // Parse the AI response
      const aiResponseContent = completion.content || '';

      try {
        aiContent = JSON.parse(aiResponseContent);
        // Manually add the raw_text field after parsing
        aiContent.raw_text = truncatedText;
        // Add a note that only the first page was processed
        aiContent.processing_note = "Only the first page of the PDF was processed.";
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.log('Raw AI response:', aiResponseContent);

        // Fallback to a basic structure if parsing fails
        aiContent = {
          raw_text: truncatedText,
          summary_text: 'Failed to generate summary. Please try again.',
          summary_json: {
            key_points: [],
            main_ideas: [],
            insights: []
          },
          category: category || 'Documents',
          processing_note: "Only the first page of the PDF was processed."
        };
      }
    } catch (aiError) {
      console.error('OpenAI API error:', aiError);
      return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
    }

    // Check if the knowledgebase table exists
    try {
      const { error: tableError } = await supabaseAdmin
        .from('knowledgebase')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('Knowledgebase table does not exist:', tableError);
        return NextResponse.json({ error: 'Database table not found' }, { status: 500 });
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

      // Ensure raw_text is not the template text
      if (!aiContent.raw_text ||
          aiContent.raw_text === "The original text (truncated if necessary)") {
        aiContent.raw_text = truncatedText;
      }

      const { data, error } = await supabaseAdmin
        .from('knowledgebase')
        .insert({
          user_id: user.id,
          source_type: 'pdf',
          source_ref: fileName,
          raw_text: aiContent.raw_text,
          summary_text: aiContent.summary_text,
          summary_json: summaryJsonData,
          category: aiContent.category || category || 'Documents',
          title: fileName, // Use filename as title
          metadata: {
            processing_note: "Only the first page of the PDF was processed.",
            page_count: pageCount // Use the stored page count
          }
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

      // Record token usage before returning response
      await recordTokenUsage(
        user.id,
        '/api/process-pdf',
        'claude-3-5-sonnet', // The model we used
        inputTokens,
        outputTokens
      );

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
    console.error('Unhandled error processing PDF:', error);
    return NextResponse.json({
      error: `Internal server error: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}





