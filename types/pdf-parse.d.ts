/**
 * Type declarations for pdf-parse library
 */

declare module 'pdf-parse/lib/pdf-parse.js' {
  /**
   * Parse a PDF buffer and extract text
   * @param dataBuffer PDF file as buffer
   * @param options Optional parsing options
   * @returns Promise with the parsed PDF data
   */
  function pdfParse(
    dataBuffer: Buffer, 
    options?: {
      pagerender?: (pageData: any) => string;
      max?: number; // Maximum number of pages to parse
      version?: string;
    }
  ): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;

  export default pdfParse;
}

