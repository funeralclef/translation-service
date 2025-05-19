import { createServerComponentClient } from './supabase/server';

interface Translator {
  id: string;
  full_name: string;
  languages: string[];
  expertise: string[];
  custom_tags?: string[];
  rating: number;
  availability?: boolean;
  total_orders?: number;
  completed_orders?: number;
}

interface Order {
  id: string;
  customer_id: string;
  source_language: string;
  target_language: string;
  tags: string[];
  complexity_score?: number;
  document_url?: string;
  status: string;
}

interface RecommendationScore {
  translator_id: string;
  content_score: number;
  collaborative_score: number;
  hybrid_score: number;
}

/**
 * Content-based filtering for translator recommendations
 * Analyzes translator profiles against order requirements
 */
async function getContentBasedRecommendations(
  order: Order,
  translators: Translator[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  // Get order classification and tags
  const orderTags = order.tags || [];
  const sourceLanguage = order.source_language;
  const targetLanguage = order.target_language;
  
  // Score each translator based on content matching
  for (const translator of translators) {
    let score = 0;
    
    // Language match is essential - without language match, score remains 0
    const hasSourceLanguage = translator.languages.includes(sourceLanguage);
    const hasTargetLanguage = translator.languages.includes(targetLanguage);
    
    if (hasSourceLanguage && hasTargetLanguage) {
      // Base score for matching language pair
      score += 0.5;
      
      // Match expertise with order tags
      const expertise = translator.expertise || [];
      const customTags = translator.custom_tags || [];
      const allTags = [...expertise, ...customTags];
      
      // Calculate tag matching
      const matchingTags = orderTags.filter(tag => allTags.includes(tag));
      if (matchingTags.length > 0) {
        // Add score based on percentage of matching tags
        score += (matchingTags.length / orderTags.length) * 0.3;
      }
      
      // Factor in translator rating
      score += (translator.rating / 5) * 0.2;
    }
    
    // Availability check
    if (translator.availability === false) {
      score *= 0.5; // Reduce score if translator is not available
    }
    
    scores.set(translator.id, score);
  }
  
  return scores;
}

/**
 * Collaborative filtering for translator recommendations
 * Analyzes patterns from past orders and translator selections
 */
async function getCollaborativeRecommendations(
  order: Order,
  customerId: string
): Promise<Map<string, number>> {
  const supabase = createServerComponentClient();
  const scores = new Map<string, number>();
  
  try {
    // 1. Find similar customers based on order history
    // Get current customer's past orders
    const { data: customerOrders, error: customerOrdersError } = await supabase
      .from('orders')
      .select('id, source_language, target_language, tags')
      .eq('customer_id', customerId);
    
    if (customerOrdersError) {
      console.error('Error fetching customer orders:', customerOrdersError);
      return scores;
    }
    
    if (!customerOrders || customerOrders.length === 0) {
      // No order history, can't do collaborative filtering
      return scores;
    }
    
    // 2. Find all completed orders with similar characteristics
    const { data: similarOrders, error: similarOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        source_language,
        target_language,
        tags,
        order_assignments(translator_id, status)
      `)
      .eq('status', 'completed')
      .in('source_language', [order.source_language])
      .in('target_language', [order.target_language]);
    
    if (similarOrdersError) {
      console.error('Error fetching similar orders:', similarOrdersError);
      return scores;
    }
    
    if (!similarOrders || similarOrders.length === 0) {
      return scores;
    }
    
    // 3. Extract translator IDs and calculate frequency
    const translatorFrequency: Record<string, number> = {};
    let totalAssignments = 0;
    
    for (const order of similarOrders) {
      const assignments = order.order_assignments || [];
      
      for (const assignment of assignments) {
        if (assignment.status === 'completed') {
          translatorFrequency[assignment.translator_id] = 
            (translatorFrequency[assignment.translator_id] || 0) + 1;
          totalAssignments++;
        }
      }
    }
    
    // Calculate scores based on frequency
    if (totalAssignments > 0) {
      Object.entries(translatorFrequency).forEach(([translatorId, frequency]) => {
        scores.set(translatorId, frequency / totalAssignments);
      });
    }
    
    return scores;
  } catch (error) {
    console.error('Error in collaborative filtering:', error);
    return scores;
  }
}

/**
 * Main function to get hybrid recommendations
 * Combines content-based and collaborative filtering
 */
export async function getHybridRecommendations(
  order: Order,
  customerId: string
): Promise<Translator[]> {
  const supabase = createServerComponentClient();
  
  try {
    // 1. Get all available translators who match the language pair
    const { data: availableTranslators, error: translatorsError } = await supabase
      .from('translator_profiles')
      .select('*')
      .contains('languages', [order.source_language, order.target_language]);
    
    if (translatorsError) {
      console.error('Error fetching translators:', translatorsError);
      return [];
    }
    
    if (!availableTranslators || availableTranslators.length === 0) {
      console.log('No translators found for this language pair');
      return [];
    }
    
    // 2. Get content-based recommendations
    const contentScores = await getContentBasedRecommendations(order, availableTranslators);
    
    // 3. Get collaborative filtering recommendations
    const collaborativeScores = await getCollaborativeRecommendations(order, customerId);
    
    // 4. Combine scores for hybrid approach
    const combinedScores: RecommendationScore[] = availableTranslators.map(translator => {
      const contentScore = contentScores.get(translator.id) || 0;
      const collaborativeScore = collaborativeScores.get(translator.id) || 0;
      
      // Weighted combination
      const hybridScore = 0.6 * contentScore + 0.4 * collaborativeScore;
      
      return {
        translator_id: translator.id,
        content_score: contentScore,
        collaborative_score: collaborativeScore,
        hybrid_score: hybridScore
      };
    });
    
    // 5. Sort by hybrid score (descending)
    combinedScores.sort((a, b) => b.hybrid_score - a.hybrid_score);
    
    // 6. Map back to full translator objects
    const recommendedTranslators = combinedScores
      .map(score => {
        const translator = availableTranslators.find(t => t.id === score.translator_id);
        return translator ? {
          ...translator,
          recommendation_score: score.hybrid_score,
          content_score: score.content_score,
          collaborative_score: score.collaborative_score
        } : null;
      })
      .filter(t => t !== null) as Translator[];
    
    return recommendedTranslators;
  } catch (error) {
    console.error('Error getting hybrid recommendations:', error);
    return [];
  }
} 
