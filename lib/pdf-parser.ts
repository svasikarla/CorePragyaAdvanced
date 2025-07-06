/**
 * Custom wrapper for pdf-parse to avoid the debug mode issue
 * The original library tries to load a test file in debug mode
 */
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/**
 * Parse a PDF buffer and extract text
 * @param dataBuffer PDF file as buffer
 * @param options Optional parsing options
 * @returns Promise with the parsed PDF data
 */
export async function parsePdf(
  dataBuffer: Buffer, 
  options?: { firstPageOnly?: boolean }
): Promise<{ text: string; numpages: number; info: any }> {
  try {
    // If firstPageOnly is true, set max to 1 to process only the first page
    const parseOptions = options?.firstPageOnly ? { max: 1 } : undefined;
    return await pdfParse(dataBuffer, parseOptions);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

