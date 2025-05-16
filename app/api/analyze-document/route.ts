import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/utils/supabase/server"
import { analyzeDocument, calculateTranslationCost } from "@/utils/openai"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"

export async function POST(request: Request) {
  try {
    const supabase = createServerComponentClient()
    const { documentUrl, sourceLanguage, targetLanguage } = await request.json()

    // Download the document from Supabase storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(documentUrl.split('/').pop())

    if (downloadError) {
      throw downloadError
    }

    // Extract text based on file type
    let text = ''
    const fileName = documentUrl.toLowerCase()
    
    if (fileName.endsWith('.pdf')) {
      const pdfData = await pdfParse(await fileData.arrayBuffer())
      text = pdfData.text
    } else if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ arrayBuffer: await fileData.arrayBuffer() })
      text = result.value
    } else {
      // For plain text files
      text = await fileData.text()
    }

    // Count words
    const wordCount = text.trim().split(/\s+/).length

    // Analyze document with GPT
    const analysis = await analyzeDocument(text)

    // Calculate cost and estimated time
    const { cost, estimatedHours } = calculateTranslationCost(
      wordCount,
      analysis.complexity_score,
      sourceLanguage,
      targetLanguage
    )

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
      return NextResponse.json({ error: "Failed to fetch translators" }, { status: 500 })
    }

    // Store analysis in database
    const { error: analysisError } = await supabase
      .from("order_analysis")
      .insert({
        order_id: null, // Will be updated when order is created
        classification: analysis.classification,
        word_count: wordCount,
        complexity_score: analysis.complexity_score,
        estimated_hours: estimatedHours
      })

    if (analysisError) {
      console.error("Error storing analysis:", analysisError)
    }

    return NextResponse.json({
      classification: analysis.classification,
      wordCount,
      complexityScore: analysis.complexity_score,
      estimatedHours,
      cost,
      recommendedTranslators: translators || [],
    })
  } catch (error) {
    console.error("Error analyzing document:", error)
    return NextResponse.json({ error: "Failed to analyze document" }, { status: 500 })
  }
}