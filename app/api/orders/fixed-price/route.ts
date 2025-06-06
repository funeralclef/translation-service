import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/utils/supabase/server"
import { processDocument } from "@/utils/document-processing"

export async function POST(request: Request) {
  try {
    const supabase = createServerComponentClient()
    const { documentUrl, sourceLanguage, targetLanguage, fixedPrice, order_id } = await request.json()

    if (!documentUrl || !sourceLanguage || !targetLanguage || fixedPrice === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: documentUrl, sourceLanguage, targetLanguage, or fixedPrice" },
        { status: 400 }
      )
    }

    // Validate fixed price is a number and meets minimum requirements
    const price = Number(fixedPrice)
    if (isNaN(price) || price < 1) {
      return NextResponse.json(
        { error: "Fixed price must be a number and at least $1" },
        { status: 400 }
      )
    }

    // Process the document to extract text and count words
    const { text, wordCount } = await processDocument(documentUrl)
    
    // Get suggested minimum for this word count
    const { calculateCost } = await import("@/utils/openai");
    const suggestedMinimum = calculateCost(wordCount, 0.5, sourceLanguage, targetLanguage); // Use lowest complexity for minimum
    
    // Warn if price is below suggested minimum but allow it
    if (price < suggestedMinimum) {
      console.warn(`Fixed price $${price} is below suggested minimum $${suggestedMinimum} for ${wordCount} words`);
    }

    // For fixed price orders, we still calculate complexity but don't use it for pricing
    // We set a moderate complexity as default
    const complexityScore = 0.75
    const estimatedHours = (wordCount / 500) * complexityScore

    // Get recommended translators based on language pair
    const { data: translators, error: translatorError } = await supabase
      .from("translator_profiles")
      .select("*")
      .contains("languages", [sourceLanguage, targetLanguage])
      .limit(3)

    if (translatorError) {
      console.error("Error fetching translators:", translatorError)
      return NextResponse.json({ error: "Failed to fetch translators" }, { status: 500 })
    }

    // Store the fixed-price order analysis
    const { error: analysisError } = await supabase.from("document_analysis").insert({
      document_url: documentUrl,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      classification: ["Fixed Price"],
      word_count: wordCount,
      complexity_score: complexityScore,
      estimated_hours: estimatedHours,
      cost: price,
      is_fixed_price: true
    })

    if (analysisError) {
      console.error("Error storing fixed-price analysis:", analysisError)
      // Continue with the response even if storage fails
    }
    
    // If order_id is provided, also save to order_analysis table
    if (order_id) {
      console.log("Storing analysis in order_analysis table for fixed-price order:", order_id);
      const { error: orderAnalysisError } = await supabase.from("order_analysis").insert({
        order_id,
        classification: ["Fixed Price"],
        word_count: wordCount,
        complexity_score: complexityScore,
        estimated_hours: estimatedHours
      });
      
      if (orderAnalysisError) {
        console.error("Error storing fixed-price order analysis:", orderAnalysisError);
        // Continue with the response even if storage fails
      }
    }

    return NextResponse.json({
      classification: ["Fixed Price"],
      wordCount,
      complexityScore,
      estimatedHours: Number(estimatedHours.toFixed(2)),
      cost: price,
      isFixedPrice: true,
      recommendedTranslators: translators || [],
    })
  } catch (error) {
    console.error("Error processing fixed-price order:", error)
    return NextResponse.json({ error: "Failed to process fixed-price order" }, { status: 500 })
  }
} 