import { NextResponse } from "next/server"
import { getFileExtensionFromUrl } from "@/utils/document-processing"

// A simple endpoint to test URL validation without going through the full document processing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return NextResponse.json({
        error: "Missing URL parameter",
        usage: "Add ?url=YOUR_DOCUMENT_URL to test URL validation"
      }, { status: 400 })
    }
    
    // Test with a real URL
    console.log("Testing URL validation:", url)
    
    // 1. Extract file extension
    const fileExt = getFileExtensionFromUrl(url)
    
    // 2. Check if it's a local file path (which would be blocked)
    const isLocalPath = url.startsWith('file://') || url.startsWith('/') || url.match(/^[A-Za-z]:\\/)
    
    // 3. Check if it's a Supabase URL
    const isSupabaseUrl = url.includes('supabase.co/storage/v1/object/')
    
    // 4. Test URL accessibility with a HEAD request (doesn't download the file)
    let isAccessible = false
    let accessError = null
    
    try {
      const headResponse = await fetch(url, { method: 'HEAD' })
      isAccessible = headResponse.ok
      
      if (!headResponse.ok) {
        accessError = `URL not accessible: ${headResponse.status} ${headResponse.statusText}`
      }
    } catch (headError) {
      isAccessible = false
      accessError = `Error accessing URL: ${headError instanceof Error ? headError.message : 'Unknown error'}`
    }
    
    // 5. Check if file type is supported
    const isSupportedType = fileExt ? ['pdf', 'docx', 'txt'].includes(fileExt) : false
    
    // Build validation result
    const validationResult = {
      isValid: fileExt && isSupportedType && isAccessible && !isLocalPath,
      fileExtension: fileExt || 'unknown',
      isLocalPath,
      isSupabaseUrl,
      isAccessible,
      isSupportedType,
      accessError: !isAccessible ? accessError : null
    }
    
    // Add recommendation based on validation result
    const recommendation = !fileExt ? "URL does not contain a recognizable file extension" 
      : !isSupportedType ? `File type '${fileExt}' is not supported (only PDF, DOCX, and TXT are supported)`
      : isLocalPath ? "Local file system access is not allowed"
      : !isAccessible ? "URL is not accessible"
      : "URL is valid and can be processed"
    
    return NextResponse.json({
      url,
      validationResult,
      recommendation
    })
    
  } catch (error) {
    console.error("Error in URL validation:", error)
    return NextResponse.json({ 
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
} 