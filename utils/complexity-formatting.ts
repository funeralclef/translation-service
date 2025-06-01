/**
 * Formats complexity score with descriptive label
 * @param score - The complexity score (0.5, 0.75, or 1.0)
 * @returns A formatted string like "0.5 (Simple)" or "1.0 (Complex)"
 */
export function formatComplexity(score: number): string {
  const formattedScore = score.toFixed(2);
  
  if (score <= 0.5) {
    return `${formattedScore} (Simple)`;
  } else if (score <= 0.75) {
    return `${formattedScore} (Moderate)`;
  } else {
    return `${formattedScore} (Complex)`;
  }
}

/**
 * Gets just the descriptive label for a complexity score
 * @param score - The complexity score
 * @returns Just the label like "Simple", "Moderate", or "Complex"
 */
export function getComplexityLabel(score: number): string {
  if (score <= 0.5) {
    return "Simple";
  } else if (score <= 0.75) {
    return "Moderate";
  } else {
    return "Complex";
  }
}

/**
 * Gets a detailed description of what each complexity level means
 * @param score - The complexity score
 * @returns A detailed description of the complexity level
 */
export function getComplexityDescription(score: number): string {
  if (score <= 0.5) {
    return "Simple, general content that is straightforward to translate";
  } else if (score <= 0.75) {
    return "Moderate complexity, specialized but accessible content";
  } else {
    return "Complex content with technical jargon and specialized terminology";
  }
} 