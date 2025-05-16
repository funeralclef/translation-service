import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/utils/supabase/server"
import { processDocument } from "@/utils/document-processing"
import { analyzeDocument } from "@/utils/openai"

export async function POST(request: Request) {
  try {
    console.log("API: Starting document analysis")
    const supabase = createServerComponentClient()
    const { documentUrl, sourceLanguage, targetLanguage } = await request.json()

    console.log("API: Received document URL length:", documentUrl?.length)
    console.log("API: First 100 chars of URL:", documentUrl?.substring(0, 100))

    if (!documentUrl || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing required fields: documentUrl, sourceLanguage, or targetLanguage" },
        { status: 400 }
      )
    }

    // Verify the file is accessible before proceeding
    try {
      console.log("API: Verifying file accessibility...")
      const headResponse = await fetch(documentUrl, { method: 'HEAD' });
      
      if (!headResponse.ok) {
        console.error(`API: File not accessible: ${headResponse.status} ${headResponse.statusText}`);
        return NextResponse.json({ 
          error: `Document URL is not accessible: ${headResponse.status} ${headResponse.statusText}. Please check storage permissions.` 
        }, { status: 400 });
      }
      
      console.log("API: File verified accessible with status:", headResponse.status);
    } catch (accessError) {
      console.error("API: Error verifying file access:", accessError);
      return NextResponse.json({ 
        error: `Failed to access document URL: ${accessError instanceof Error ? accessError.message : "Unknown error"}` 
      }, { status: 400 });
    }

    // Directly use the provided URL - we've already verified it's accessible
    const fileUrl = documentUrl;
    
    // Process the document to extract text and count words
    let text = "";
    let wordCount = 0;
    
    try {
      console.log("API: Starting document processing...")
      const processResult = await processDocument(fileUrl);
      text = processResult.text;
      wordCount = processResult.wordCount;
      console.log("API: Document processed successfully. Word count:", wordCount)
    } catch (processError) {
      console.error("API: Error details for document processing:", processError);
      // Format the stack trace to help debug where the error is occurring
      const stack = processError instanceof Error ? processError.stack : 'No stack trace';
      console.error("API: Full error stack:", stack);
      
      return NextResponse.json({ 
        error: `Failed to process document: ${processError instanceof Error ? processError.message : "Unknown error"}. Please ensure the file is accessible and in a supported format (PDF, DOCX, TXT).`,
        stack: stack
      }, { status: 500 });
    }

    // Check if OPENAI_API_KEY exists
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing in environment variables");
      return NextResponse.json({ 
        error: "OpenAI API Key is not configured. Please add it to your environment variables."
      }, { status: 500 });
    }

    // Analyze the document with OpenAI
    let classification = [];
    let complexityScore = 0;
    let estimatedHours = 0;
    let cost = 0;
    
    try {
      console.log("Calling OpenAI for document analysis...")
      const analysisResult = await analyzeDocument(
        text,
        wordCount,
        sourceLanguage,
        targetLanguage
      );
      
      classification = analysisResult.classification;
      complexityScore = analysisResult.complexityScore;
      estimatedHours = analysisResult.estimatedHours;
      cost = analysisResult.cost;
      console.log("OpenAI analysis completed successfully")
    } catch (analysisError) {
      console.error("Error details for OpenAI analysis:", analysisError);
      // If AI analysis fails, use fallback values
      classification = ["General"];
      complexityScore = 0.75; // Moderate complexity as fallback
      estimatedHours = (wordCount / 500) * complexityScore;
      cost = Math.max(25, wordCount * 0.05); // Basic cost calculation
      console.log("Using fallback values due to OpenAI analysis failure")
    }

    // Get recommended translators based on language pair and classification
    const { data: translators, error: translatorError } = await supabase
      .from("translator_profiles")
      .select("*")
      .contains("languages", [sourceLanguage, targetLanguage])
      .contains("expertise", analysis.classification)
      .eq("availability", true)
      .order("rating", { ascending: false })
      .limit(3)

    if (translatorError) {
      console.error("Error fetching translators:", translatorError)
      // Continue without translators if there's an error
    }

    // Store the analysis results in the database
    try {
      const { error: analysisError } = await supabase.from("document_analysis").insert({
        document_url: documentUrl,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        classification,
        word_count: wordCount,
        complexity_score: complexityScore,
        estimated_hours: estimatedHours,
        cost
      })

      if (analysisError) {
        console.error("Error storing analysis:", analysisError)
        // Continue with the response even if storage fails
      }
    } catch (storageError) {
      console.error("Error storing analysis in database:", storageError)
      // Continue with the response even if storage fails
    }

    console.log("Document analysis completed successfully")
    return NextResponse.json({
      classification,
      wordCount,
      complexityScore,
      estimatedHours,
      cost,
      recommendedTranslators: translators || [],
    })
  } catch (error) {
    console.error("Error analyzing document:", error)
    return NextResponse.json({ 
      error: `Failed to analyze document: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or contact support.` 
    }, { status: 500 })
  }
}