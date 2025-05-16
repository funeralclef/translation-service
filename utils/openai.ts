import OpenAI from 'openai';

// Create OpenAI client instance
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to analyze document content
export async function analyzeDocument(text: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a document analysis expert. Analyze the given text and provide:
            1. Document classification (technical, legal, medical, etc.)
            2. Complexity score (0.0-1.0)
            3. Subject matter tags
            
            Format the response as JSON with the following structure:
            {
              "classification": ["category1", "category2"],
              "complexity_score": 0.75,
              "tags": ["tag1", "tag2", "tag3"]
            }`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

// Calculate translation cost based on various factors
export function calculateTranslationCost(
  wordCount: number,
  complexityScore: number,
  sourceLanguage: string,
  targetLanguage: string
): { cost: number; estimatedHours: number } {
  // Base rate per word (in USD)
  const baseRate = 0.12;
  
  // Language pair complexity multipliers
  const languageMultiplier = getLanguageMultiplier(sourceLanguage, targetLanguage);
  
  // Calculate estimated hours based on word count and complexity
  const wordsPerHour = 250; // Average translator speed
  const estimatedHours = (wordCount / wordsPerHour) * complexityScore * languageMultiplier;
  
  // Calculate final cost
  const cost = wordCount * baseRate * complexityScore * languageMultiplier;
  
  return {
    cost: Math.round(cost * 100) / 100, // Round to 2 decimal places
    estimatedHours: Math.round(estimatedHours * 100) / 100
  };
}

// Helper function to determine language pair complexity
function getLanguageMultiplier(source: string, target: string): number {
  // Define language families
  const languageFamilies: { [key: string]: string } = {
    English: "Germanic",
    German: "Germanic",
    French: "Romance",
    Spanish: "Romance",
    Italian: "Romance",
    Portuguese: "Romance",
    Russian: "Slavic",
    Ukrainian: "Slavic",
    Chinese: "Sinitic",
    Japanese: "Japonic",
    Korean: "Koreanic",
    Arabic: "Semitic"
  };

  // Get language families for source and target
  const sourceFamily = languageFamilies[source] || "Other";
  const targetFamily = languageFamilies[target] || "Other";

  // Same family: 1.0x, Different family: 1.5x, Special cases: 2.0x
  if (sourceFamily === targetFamily) {
    return 1.0;
  } else if (
    (sourceFamily === "Sinitic" && targetFamily === "Germanic") ||
    (sourceFamily === "Germanic" && targetFamily === "Sinitic") ||
    (sourceFamily === "Semitic" && targetFamily === "Germanic") ||
    (sourceFamily === "Germanic" && targetFamily === "Semitic")
  ) {
    return 2.0;
  }
  return 1.5;
}