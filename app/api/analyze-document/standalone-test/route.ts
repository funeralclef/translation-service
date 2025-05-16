import { NextResponse } from "next/server";
import mammoth from 'mammoth';
import { createServerComponentClient } from "@/utils/supabase/server";

/**
 * Independent implementation to test document processing without using shared utilities
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    
    if (!url) {
      return NextResponse.json({
        error: "Missing URL. Use ?url=YOUR_DOCUMENT_URL to test document processing."
      }, { status: 400 });
    }
    
    console.log("STANDALONE: Testing URL:", url.substring(0, 100) + "...");
    
    // Extract extension from URL directly
    const urlWithoutParams = url.split('?')[0];
    const fileNameMatch = urlWithoutParams.match(/\.([^.]+)$/);
    const fileExt = fileNameMatch ? fileNameMatch[1].toLowerCase() : null;
    
    console.log("STANDALONE: Detected file extension:", fileExt);
    
    if (!fileExt || !['pdf', 'docx', 'txt'].includes(fileExt)) {
      return NextResponse.json({
        error: `Unsupported file type: ${fileExt || 'unknown'}. Only PDF, DOCX, and TXT files are supported.`
      }, { status: 400 });
    }
    
    // Download the file
    console.log("STANDALONE: Downloading file...");
    let fileBuffer;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log(`STANDALONE: File downloaded successfully, size: ${fileBuffer.length} bytes`);
    } catch (downloadError) {
      console.error("STANDALONE: Download error:", downloadError);
      return NextResponse.json({
        error: `Download failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
      }, { status: 500 });
    }
    
    // Process based on file type - avoid using pdf-parse
    let text = '';
    let wordCount = 0;
    
    try {
      console.log(`STANDALONE: Processing ${fileExt} document...`);
      
      if (fileExt === 'docx') {
        // Use mammoth for DOCX
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        text = result.value;
      } else if (fileExt === 'txt') {
        // Simple text conversion
        text = fileBuffer.toString('utf-8');
      } else if (fileExt === 'pdf') {
        // Mock PDF text to avoid pdf-parse issues
        text = "This is mock text from the PDF document. The PDF parsing library has been bypassed to avoid file system access errors.";
      }
      
      // Basic word count
      wordCount = text.split(/\s+/).filter(Boolean).length;
      
      console.log(`STANDALONE: Processing complete. Text length: ${text.length}, Word count: ${wordCount}`);
    } catch (processError) {
      console.error("STANDALONE: Processing error:", processError);
      return NextResponse.json({
        error: `Processing failed: ${processError instanceof Error ? processError.message : 'Unknown error'}`
      }, { status: 500 });
    }
    
    // Return results
    return NextResponse.json({
      success: true,
      fileType: fileExt,
      fileSize: fileBuffer.length,
      textLength: text.length,
      wordCount,
      textPreview: text.substring(0, 300) + (text.length > 300 ? '...' : '')
    });
    
  } catch (error) {
    console.error("STANDALONE: Error:", error);
    return NextResponse.json({
      error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
} 