import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/utils/supabase/server"
import { getFileExtensionFromUrl } from "@/utils/document-processing"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }
    
    // Log the URL we're testing
    console.log("Testing document URL handling for:", url)
    
    // Detailed URL parsing for debugging
    const urlNoParams = url.split('?')[0]
    const urlParts = url.split('/')
    const lastPart = urlParts[urlParts.length - 1]
    const lastPartNoParams = lastPart.split('?')[0]
    const manualExtension = lastPartNoParams.split('.').pop()?.toLowerCase()
    
    // Get file extension using our utility function
    const fileExt = getFileExtensionFromUrl(url)
    
    // Check what type of URL we're dealing with
    const isLocal = url.startsWith('file://') || url.startsWith('/') || url.match(/^[A-Za-z]:\\/)
    const isSupabasePublic = url.includes('supabase.co/storage/v1/object/public/')
    const isSupabaseAuth = url.includes('supabase.co/storage/v1/object/authenticated/')
    const isSupabaseSigned = url.includes('supabase.co/storage/v1/object/sign/')
    
    // Check for bucket and file
    const bucketIndex = urlParts.findIndex(part => part === 'documents')
    const bucketName = bucketIndex > -1 ? 'documents' : null
    
    // Extract path without query params
    let filePath = null
    if (bucketIndex > -1) {
      const pathParts = urlParts.slice(bucketIndex + 1)
      const queryIndex = pathParts.findIndex(part => part.includes('?'))
      if (queryIndex > -1) {
        // Remove query params from path
        pathParts[queryIndex] = pathParts[queryIndex].split('?')[0]
        filePath = pathParts.slice(0, queryIndex + 1).join('/')
      } else {
        filePath = pathParts.join('/')
      }
    }
    
    // Create a signed URL if possible
    let signedUrl = null
    if (bucketName && filePath) {
      const supabase = createServerComponentClient()
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60)
      
      if (!error && data?.signedUrl) {
        signedUrl = data.signedUrl
      }
    }
    
    return NextResponse.json({
      originalUrl: url,
      urlParsingDetails: {
        urlNoParams,
        lastPart,
        lastPartNoParams,
        manualExtension,
      },
      urlAnalysis: {
        fileExtension: fileExt,
        isLocal,
        isSupabasePublic,
        isSupabaseAuth,
        isSupabaseSigned,
        isSupportedExtension: fileExt ? ['pdf', 'docx', 'txt'].includes(fileExt) : false,
      },
      bucketInfo: {
        bucketName,
        filePath,
        signedUrl: signedUrl ? signedUrl.substring(0, 100) + '...' : null,
      },
      recommendation: isLocal 
        ? "ERROR: Local file access is blocked" 
        : (isSupabasePublic || isSupabaseAuth || isSupabaseSigned)
            ? "Use direct URL with fetch" 
            : (signedUrl ? "Use signed URL" : "Use direct URL"),
    })
  } catch (error) {
    console.error("Error testing document URL:", error)
    return NextResponse.json({ 
      error: `Error testing URL: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
} 