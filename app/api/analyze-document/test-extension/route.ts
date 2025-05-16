import { NextResponse } from "next/server"
import { getFileExtensionFromUrl } from "@/utils/document-processing"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }
    
    // Log the URL we're testing
    console.log("Testing file extension extraction for:", url)
    
    // Test getFileExtensionFromUrl function
    const fileExt = getFileExtensionFromUrl(url)
    
    // Manual extraction for comparison
    // First remove query params
    const urlNoQuery = url.split('?')[0]
    // Get last part of path
    const fileName = urlNoQuery.split('/').pop() || ''
    // Get extension
    const manualExt = fileName.split('.').pop()?.toLowerCase()
    
    // Test different scenarios
    const scenarios = [
      {
        name: "Current implementation",
        extension: fileExt
      },
      {
        name: "Manual extraction",
        extension: manualExt
      },
      {
        name: "Split on '?' then last part",
        extension: url.split('?')[0].split('/').pop()?.split('.').pop()?.toLowerCase()
      }
    ]
    
    return NextResponse.json({
      originalUrl: url,
      testResults: scenarios,
      recommendation: fileExt || "Could not determine file extension"
    })
  } catch (error) {
    console.error("Error testing file extension extraction:", error)
    return NextResponse.json({ 
      error: `Error testing file extension: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
} 