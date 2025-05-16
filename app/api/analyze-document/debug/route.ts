import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/utils/supabase/server"
import { getFileExtensionFromUrl, downloadFromStorage } from "@/utils/document-processing"

export async function POST(request: Request) {
  try {
    const { documentUrl } = await request.json()
    
    if (!documentUrl) {
      return NextResponse.json({ error: "documentUrl is required" }, { status: 400 })
    }
    
    console.log("DEBUG: Testing document processing with URL:", documentUrl.substring(0, 100) + "...")
    
    // Step 1: Test file extension extraction
    console.log("Step 1: Testing file extension extraction")
    const fileExt = getFileExtensionFromUrl(documentUrl)
    console.log("File extension extracted:", fileExt)
    
    // Manual file extension extraction for comparison
    const urlNoQuery = documentUrl.split('?')[0]
    const fileName = urlNoQuery.split('/').pop() || ''
    const manualExt = fileName.split('.').pop()?.toLowerCase()
    console.log("Manual file extension extraction:", manualExt)
    
    // Check if extension is supported
    const supportedExtensions = ['pdf', 'docx', 'txt']
    const isSupported = fileExt ? supportedExtensions.includes(fileExt) : false
    console.log("Is extension supported:", isSupported)
    
    if (!fileExt) {
      return NextResponse.json({ 
        error: "Could not determine file type. URL may be malformed.",
        urlNoQuery,
        fileName,
        manualExt
      }, { status: 400 })
    }
    
    if (!isSupported) {
      return NextResponse.json({ 
        error: `Unsupported file type: ${fileExt}. Only PDF, DOCX, and TXT files are supported.` 
      }, { status: 400 })
    }
    
    // Step 2: Test URL handling (but don't download)
    console.log("Step 2: Testing URL handling")
    const isLocalPath = documentUrl.startsWith('file://') || documentUrl.startsWith('/') || documentUrl.match(/^[A-Za-z]:\\/)
    const isSupabaseUrl = documentUrl.includes('supabase.co/storage/v1/object/')
    
    if (isLocalPath) {
      console.error("ERROR: Local file path detected:", documentUrl)
      return NextResponse.json({ error: "Local file system access is not allowed" }, { status: 403 })
    }
    
    // Step 3: Test direct URL accessibility (HEAD request only)
    console.log("Step 3: Testing URL accessibility")
    try {
      const headResponse = await fetch(documentUrl, { method: 'HEAD' })
      console.log("HEAD request status:", headResponse.status, headResponse.statusText)
      
      if (!headResponse.ok) {
        console.error(`URL is not accessible: ${headResponse.status} ${headResponse.statusText}`)
        return NextResponse.json({ 
          error: `Document URL is not accessible: ${headResponse.status} ${headResponse.statusText}` 
        }, { status: 400 })
      }
    } catch (headError) {
      console.error("Error accessing URL:", headError)
      return NextResponse.json({ 
        error: `Failed to access document URL: ${headError instanceof Error ? headError.message : 'Unknown error'}` 
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      fileExtension: fileExt,
      isSupported,
      isLocalPath,
      isSupabaseUrl,
      message: "URL and file extension validation passed successfully"
    })
    
  } catch (error) {
    console.error("Error in debug endpoint:", error)
    return NextResponse.json({ 
      error: `Debug error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
} 