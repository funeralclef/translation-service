import { NextResponse } from "next/server";
import { getFileExtensionFromUrl, downloadFromStorage, extractTextFromDocument } from "@/utils/document-processing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format") || "auto"; // Can be pdf, docx, txt or auto
  
  if (!url) {
    return NextResponse.json({
      error: "Missing URL parameter. Use ?url=YOUR_DOCUMENT_URL to test document extraction."
    }, { status: 400 });
  }
  
  try {
    console.log(`TEST FORMATS: Testing document extraction for URL: ${url.substring(0, 100)}...`);
    
    // Test file extension detection
    const detectedFormat = getFileExtensionFromUrl(url);
    console.log(`TEST FORMATS: Detected format: ${detectedFormat}`);
    
    // Use specified format or detected format
    const fileFormat = format === "auto" ? detectedFormat : format;
    
    if (!fileFormat || !["pdf", "docx", "txt"].includes(fileFormat)) {
      return NextResponse.json({
        error: `Unsupported file format: ${fileFormat || "unknown"}. 
               Supported formats are pdf, docx, txt.`
      }, { status: 400 });
    }
    
    // Try to download the file
    console.log(`TEST FORMATS: Downloading file...`);
    let fileBuffer;
    try {
      fileBuffer = await downloadFromStorage(url);
      console.log(`TEST FORMATS: Download successful, size: ${fileBuffer.length} bytes`);
    } catch (downloadError) {
      console.error(`TEST FORMATS: Download error:`, downloadError);
      return NextResponse.json({
        error: `Failed to download document: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
        stage: "download"
      }, { status: 500 });
    }
    
    // Try to extract text
    console.log(`TEST FORMATS: Extracting text from ${fileFormat} document...`);
    let text;
    try {
      text = await extractTextFromDocument(fileBuffer, fileFormat);
      console.log(`TEST FORMATS: Text extraction successful, length: ${text.length} chars`);
    } catch (extractError) {
      console.error(`TEST FORMATS: Text extraction error:`, extractError);
      return NextResponse.json({
        error: `Failed to extract text: ${extractError instanceof Error ? extractError.message : "Unknown error"}`,
        stage: "extraction",
        format: fileFormat
      }, { status: 500 });
    }
    
    // Return sample of extracted text
    const textPreview = text.substring(0, 500) + (text.length > 500 ? "..." : "");
    
    return NextResponse.json({
      success: true,
      url,
      format: fileFormat,
      fileSizeBytes: fileBuffer.length,
      textLengthChars: text.length,
      textPreview
    });
    
  } catch (error) {
    console.error("TEST FORMATS: Overall error:", error);
    return NextResponse.json({
      error: `Test failed: ${error instanceof Error ? error.message : "Unknown error"}`
    }, { status: 500 });
  }
} 