import OpenAI from 'openai';

// Initialize OpenAI client
let openai: OpenAI | null = null;

try {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY environment variable is not set");
  } else {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("OpenAI client initialized successfully");
  }
} catch (error) {
  console.error("Error initializing OpenAI client:", error);
}

/**
 * Document analysis result interface
 */
export interface DocumentAnalysisResult {
  classification: string[];
  complexityScore: number;
  estimatedHours: number;
  cost: number;
}

/**
 * Document complexity levels
 */
const COMPLEXITY_FACTORS = {
  SIMPLE: 0.5,    // General content, straightforward
  MODERATE: 0.75, // Specialized but accessible
  COMPLEX: 1.0,   // Technical jargon, specialized field
  VERY_COMPLEX: 1.25, // Highly technical, dense content
};

/**
 * Rate per word in dollars - base rate
 */
const BASE_RATE_PER_WORD = 0.05;

/**
 * Standard processing speed in words per hour
 */
const STANDARD_WORDS_PER_HOUR = 500;

/**
 * Available classifications for documents
 */
export const DOCUMENT_CLASSIFICATIONS = [
  'Technical',
  'Legal',
  'Medical',
  'Financial',
  'Marketing',
  'Literary',
  'Academic',
  'Scientific',
  'Software',
  'Engineering',
  'Business',
  'General'
];

/**
 * Analyzes a document's text using OpenAI GPT
 */
export async function analyzeDocument(
  text: string, 
  wordCount: number,
  sourceLanguage: string,
  targetLanguage: string
): Promise<DocumentAnalysisResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    if (!openai) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    
    console.log(`Analyzing document: ${wordCount} words, ${sourceLanguage} to ${targetLanguage}`);
    
    // Check if we have text content to analyze
    if (!text || text.length === 0) {
      console.warn("Empty text provided for analysis, using fallback values");
      return {
        classification: ['General'],
        complexityScore: 0.75,
        estimatedHours: wordCount > 0 ? (wordCount / 500) * 0.75 : 1,
        cost: Math.max(25, wordCount * 0.05)
      };
    }
    
    // Truncate text if it's very large to avoid token limits
    const truncatedText = text.length > 8000 
      ? text.substring(0, 8000) + "... (text truncated for analysis)"
      : text;
    
    console.log(`Using ${truncatedText.length} characters for analysis`);
    
    // Prepare prompt for OpenAI
    const prompt = `
You are a professional document analyzer for a translation service. Analyze the following document text:

---
${truncatedText}
---

Based on the content, provide the following information in JSON format:
1. Classification: Categorize the document into 1-3 of these categories: ${DOCUMENT_CLASSIFICATIONS.join(', ')}
2. Complexity: Assess the document's translation complexity on a scale of 0.5 to 1.25, where:
   - 0.5: Simple, general content
   - 0.75: Moderate complexity, specialized but accessible
   - 1.0: Complex, technical jargon, specialized field
   - 1.25: Very complex, highly technical, dense content

Return ONLY a valid JSON object with these fields:
{
  "classification": ["category1", "category2"],
  "complexityScore": number
}`;

    console.log("Sending request to OpenAI...");
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional document analysis assistant. Only respond with the requested JSON format, nothing else.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    console.log("Received response from OpenAI");
    
    // Extract analysis results
    const analysisText = response.choices[0]?.message?.content || '';
    
    if (!analysisText) {
      throw new Error('Empty response from OpenAI');
    }
    
    console.log("Raw analysis result:", analysisText);
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      throw new Error(`Invalid JSON response from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    // Validate response
    if (!analysis.classification || !Array.isArray(analysis.classification) || 
        analysis.complexityScore === undefined || typeof analysis.complexityScore !== 'number') {
      console.error("Invalid response format from OpenAI:", analysis);
      throw new Error('Invalid response format from OpenAI');
    }
    
    console.log("Parsed analysis:", JSON.stringify(analysis));

    // Calculate estimated hours based on word count and complexity
    const estimatedHours = calculateEstimatedHours(wordCount, analysis.complexityScore);
    
    // Calculate cost based on word count, complexity, and language pair
    const cost = calculateCost(wordCount, analysis.complexityScore, sourceLanguage, targetLanguage);

    console.log(`Analysis completed: Complexity ${analysis.complexityScore}, Est. Hours: ${estimatedHours}, Cost: $${cost}`);
    
    return {
      classification: analysis.classification,
      complexityScore: analysis.complexityScore,
      estimatedHours,
      cost
    };
  } catch (error) {
    console.error('Error analyzing document with OpenAI:', error);
    
    // Provide detailed error message
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('OpenAI API key is invalid or missing. Please check your environment variables.');
      } else if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
        throw new Error('Connection to OpenAI timed out. Please try again later.');
      } else if (error.message.includes('rate limit')) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
    }
    
    throw new Error(`Failed to analyze document with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculates estimated translation time in hours
 */
function calculateEstimatedHours(wordCount: number, complexityScore: number): number {
  // Adjust words per hour based on complexity
  const adjustedWordsPerHour = STANDARD_WORDS_PER_HOUR / complexityScore;
  
  // Calculate hours
  const hours = wordCount / adjustedWordsPerHour;
  
  // Round to 2 decimal places
  return Number(hours.toFixed(2));
}

/**
 * Calculates translation cost based on word count, complexity and language pair
 */
function calculateCost(
  wordCount: number, 
  complexityScore: number, 
  sourceLanguage: string, 
  targetLanguage: string
): number {
  // Base cost calculation
  let costPerWord = BASE_RATE_PER_WORD * complexityScore;
  
  // Apply language pair modifier
  // Some language pairs are more expensive due to rarity of translators
  const languagePairModifier = getLanguagePairModifier(sourceLanguage, targetLanguage);
  costPerWord *= languagePairModifier;
  
  // Calculate total cost
  const totalCost = wordCount * costPerWord;
  
  // Minimum cost of $25
  const finalCost = Math.max(25, totalCost);
  
  // Round to 2 decimal places
  return Number(finalCost.toFixed(2));
}

/**
 * Gets a modifier for the language pair
 */
function getLanguagePairModifier(sourceLanguage: string, targetLanguage: string): number {
  // Common language pairs have a lower modifier
  const commonLanguages = ['English', 'Spanish', 'French', 'German', 'Portuguese'];
  
  const sourceIsCommon = commonLanguages.includes(sourceLanguage);
  const targetIsCommon = commonLanguages.includes(targetLanguage);
  
  if (sourceIsCommon && targetIsCommon) {
    return 1.0;  // Standard rate for common language pairs
  } else if (sourceIsCommon || targetIsCommon) {
    return 1.2;  // 20% increase when one language is less common
  } else {
    return 1.5;  // 50% increase for rare language pairs
  }
} 