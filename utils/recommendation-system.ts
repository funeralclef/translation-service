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
  recommendation_score?: number;
  content_score?: number;
  collaborative_score?: number;
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
  
  console.group('🎯 CONTENT-BASED FILTERING');
  console.log('📊 Order Analysis:', {
    orderId: order.id,
    sourceLanguage: order.source_language,
    targetLanguage: order.target_language,
    tags: order.tags,
    tagsCount: order.tags?.length || 0
  });
  console.log('👥 Available Translators:', translators.length);
  
  // Get order classification and tags
  const orderTags = order.tags || [];
  const sourceLanguage = order.source_language;
  const targetLanguage = order.target_language;
  
  console.log('\n📈 SCORING EACH TRANSLATOR:');
  console.log('Scoring Formula: Base Language Match (0.5) + Tag Matching (0.3) + Rating Factor (0.2)');
  console.log('Availability Penalty: -50% if unavailable\n');
  
  // Score each translator based on content matching
  for (const translator of translators) {
    console.group(`👤 ${translator.full_name} (${translator.id})`);
    
    let score = 0;
    let scoreBreakdown = {
      languageMatch: 0,
      tagMatching: 0,
      ratingFactor: 0,
      availabilityPenalty: 1
    };
    
    // Language match is essential - without language match, score remains 0
    const hasSourceLanguage = translator.languages.includes(sourceLanguage);
    const hasTargetLanguage = translator.languages.includes(targetLanguage);
    
    console.log('🔍 Language Analysis:', {
      translatorLanguages: translator.languages,
      hasSourceLanguage,
      hasTargetLanguage,
      required: `${sourceLanguage} → ${targetLanguage}`
    });
    
    if (hasSourceLanguage && hasTargetLanguage) {
      // Base score for matching language pair
      score += 0.5;
      scoreBreakdown.languageMatch = 0.5;
      console.log('✅ Language Match: +0.5 points');
      
      // Match expertise with order tags
      const expertise = translator.expertise || [];
      const customTags = translator.custom_tags || [];
      const allTags = [...expertise, ...customTags];
      
      console.log('🏷️ Tag Analysis:', {
        orderTags,
        translatorExpertise: expertise,
        translatorCustomTags: customTags,
        allTranslatorTags: allTags
      });
      
      // Calculate tag matching
      const matchingTags = orderTags.filter(tag => allTags.includes(tag));
      if (matchingTags.length > 0) {
        // Add score based on percentage of matching tags
        const tagScore = (matchingTags.length / orderTags.length) * 0.3;
        score += tagScore;
        scoreBreakdown.tagMatching = tagScore;
        console.log(`✅ Tag Matching: ${matchingTags.length}/${orderTags.length} tags matched`);
        console.log(`   Matching tags: [${matchingTags.join(', ')}]`);
        console.log(`   Tag score: (${matchingTags.length}/${orderTags.length}) × 0.3 = +${tagScore.toFixed(3)} points`);
      } else {
        console.log('❌ No matching tags found');
      }
      
      // Factor in translator rating
      const ratingScore = (translator.rating / 5) * 0.2; // Restored to original 5-point scale
      score += ratingScore;
      scoreBreakdown.ratingFactor = ratingScore;
      console.log(`⭐ Rating Factor: (${translator.rating}/5) × 0.2 = +${ratingScore.toFixed(3)} points`);
    } else {
      console.log('❌ Language requirements not met - score remains 0');
    }
    
    // Availability check
    console.log('📅 Availability:', {
      available: translator.availability !== false,
      status: translator.availability === false ? 'Unavailable' : 'Available'
    });
    
    if (translator.availability === false) {
      score *= 0.5; // Reduce score if translator is not available
      scoreBreakdown.availabilityPenalty = 0.5;
      console.log('⚠️ Availability Penalty: Score reduced by 50%');
    }
    
    const finalScore = score;
    scores.set(translator.id, finalScore);
    
    console.log('🎯 FINAL CONTENT SCORE:', {
      breakdown: scoreBreakdown,
      calculation: `${scoreBreakdown.languageMatch} + ${scoreBreakdown.tagMatching.toFixed(3)} + ${scoreBreakdown.ratingFactor.toFixed(3)} × ${scoreBreakdown.availabilityPenalty}`,
      finalScore: finalScore.toFixed(4)
    });
    
    console.groupEnd();
  }
  
  const sortedScores = Array.from(scores.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10); // Show top 10
    
  console.log('\n📊 CONTENT-BASED SCORES SUMMARY:');
  console.table(sortedScores.map(([id, score]) => ({
    'Translator ID': id.slice(0, 8) + '...',
    'Content Score': score.toFixed(4),
    'Translator Name': translators.find(t => t.id === id)?.full_name || 'Unknown'
  })));
  
  console.groupEnd();
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
  
  console.group('🤝 COLLABORATIVE FILTERING');
  console.log('📊 Customer Analysis:', {
    customerId: customerId,
    orderLanguagePair: `${order.source_language} → ${order.target_language}`,
    orderTags: order.tags
  });
  
  try {
    // 1. Find similar customers based on order history
    // Get current customer's past orders
    console.log('\n🔍 Step 1: Analyzing Customer Order History...');
    const { data: customerOrders, error: customerOrdersError } = await supabase
      .from('orders')
      .select('id, source_language, target_language, tags')
      .eq('customer_id', customerId);
    
    if (customerOrdersError) {
      console.error('❌ Error fetching customer orders:', customerOrdersError);
      console.groupEnd();
      return scores;
    }
    
    console.log('📈 Customer Order History:', {
      totalOrders: customerOrders?.length || 0,
      orders: customerOrders?.map(o => ({
        id: o.id.slice(0, 8) + '...',
        languagePair: `${o.source_language} → ${o.target_language}`,
        tags: o.tags
      })) || []
    });
    
    if (!customerOrders || customerOrders.length === 0) {
      console.log('⚠️ No order history found - collaborative filtering not possible');
      console.log('💡 Recommendation: Content-based filtering will be the primary method');
      console.groupEnd();
      return scores;
    }
    
    // 2. Find all completed orders with similar characteristics
    console.log('\n🔍 Step 2: Finding Similar Completed Orders...');
    console.log('Searching for orders with matching language pair:', `${order.source_language} → ${order.target_language}`);
    
    const { data: similarOrders, error: similarOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        source_language,
        target_language,
        tags,
        status,
        order_assignments(translator_id)
      `)
      .eq('status', 'completed')
      .in('source_language', [order.source_language])
      .in('target_language', [order.target_language]);
    
    if (similarOrdersError) {
      console.error('❌ Error fetching similar orders:', similarOrdersError);
      console.groupEnd();
      return scores;
    }
    
    console.log('📊 Similar Orders Found:', {
      totalSimilarOrders: similarOrders?.length || 0,
      languagePair: `${order.source_language} → ${order.target_language}`
    });
    
    if (!similarOrders || similarOrders.length === 0) {
      console.log('⚠️ No similar completed orders found');
      console.log('💡 Collaborative filtering cannot provide recommendations');
      console.groupEnd();
      return scores;
    }
    
    // Log some example similar orders
    console.log('📋 Example Similar Orders:', 
      similarOrders.slice(0, 5).map(o => ({
        id: o.id.slice(0, 8) + '...',
        customerId: o.customer_id.slice(0, 8) + '...',
        status: o.status,
        assignments: o.order_assignments?.length || 0,
        assignmentDetails: o.order_assignments?.map(a => ({
          translatorId: a.translator_id?.slice(0, 8) + '...',
          hasTranslator: !!a.translator_id
        })) || []
      }))
    );
    
    // 3. Extract translator IDs and calculate frequency
    console.log('\n🔍 Step 3: Calculating Translator Success Frequency...');
    console.log('🔧 FIXED LOGIC: Now checking order.status === "completed" + assignment exists');
    
    const translatorFrequency: Record<string, number> = {};
    const translatorDetails: Record<string, any[]> = {};
    let totalAssignments = 0;
    let skippedAssignments = 0;
    let orderStatusBreakdown: Record<string, number> = {};
    
    for (const similarOrder of similarOrders) {
      const assignments = similarOrder.order_assignments || [];
      orderStatusBreakdown[similarOrder.status] = (orderStatusBreakdown[similarOrder.status] || 0) + 1;
      
      console.log(`📋 Order ${similarOrder.id.slice(0, 8)}... (status: ${similarOrder.status}) has ${assignments.length} assignments`);
      
      // Since we're already filtering by completed orders, we just need to check assignments exist
      for (const assignment of assignments) {
        if (assignment.translator_id) {
          console.log(`   ✅ Valid assignment: translator=${assignment.translator_id?.slice(0, 8)}..., order_completed=true`);
          
          translatorFrequency[assignment.translator_id] = 
            (translatorFrequency[assignment.translator_id] || 0) + 1;
          
          if (!translatorDetails[assignment.translator_id]) {
            translatorDetails[assignment.translator_id] = [];
          }
          translatorDetails[assignment.translator_id].push({
            orderId: similarOrder.id.slice(0, 8) + '...',
            customerId: similarOrder.customer_id.slice(0, 8) + '...',
            tags: similarOrder.tags
          });
          
          totalAssignments++;
        } else {
          console.log(`   ❌ Invalid assignment: translator=null`);
          skippedAssignments++;
        }
      }
    }
    
    console.log('📊 Order Status Breakdown:', orderStatusBreakdown);
    console.log('📈 Translator Frequency Analysis:', {
      totalCompletedAssignments: totalAssignments,
      skippedAssignments: skippedAssignments,
      uniqueTranslators: Object.keys(translatorFrequency).length,
      willHaveCollaborativeData: totalAssignments > 0
    });
    
    // Show detailed frequency breakdown
    console.log('\n📊 TRANSLATOR FREQUENCY BREAKDOWN:');
    Object.entries(translatorFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([translatorId, frequency]) => {
        const percentage = ((frequency / totalAssignments) * 100).toFixed(1);
        console.group(`👤 Translator ${translatorId.slice(0, 8)}...`);
        console.log(`Completed Orders: ${frequency}/${totalAssignments} (${percentage}%)`);
        console.log('Order Examples:', translatorDetails[translatorId]?.slice(0, 3));
        console.groupEnd();
      });
    
    // Calculate scores based on frequency
    if (totalAssignments > 0) {
      console.log('\n🧮 Calculating Collaborative Scores...');
      console.log('Formula: Translator Frequency / Total Assignments');
      
      Object.entries(translatorFrequency).forEach(([translatorId, frequency]) => {
        const collaborativeScore = frequency / totalAssignments;
        scores.set(translatorId, collaborativeScore);
        
        console.log(`👤 ${translatorId.slice(0, 8)}...: ${frequency}/${totalAssignments} = ${collaborativeScore.toFixed(4)}`);
      });
    }
    
    const sortedCollabScores = Array.from(scores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
      
    console.log('\n📊 COLLABORATIVE SCORES SUMMARY:');
    console.table(sortedCollabScores.map(([id, score]) => ({
      'Translator ID': id.slice(0, 8) + '...',
      'Collaborative Score': score.toFixed(4),
      'Frequency': translatorFrequency[id] || 0,
      'Percentage': ((score * 100).toFixed(1) + '%')
    })));
    
    console.groupEnd();
    return scores;
  } catch (error) {
    console.error('❌ Error in collaborative filtering:', error);
    console.groupEnd();
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
  
  console.group('🚀 HYBRID RECOMMENDATION SYSTEM');
  console.log('🎯 Starting hybrid recommendation process...');
  console.log('📊 Input Parameters:', {
    orderId: order.id,
    customerId: customerId,
    sourceLanguage: order.source_language,
    targetLanguage: order.target_language,
    orderTags: order.tags,
    complexityScore: order.complexity_score
  });
  
  try {
    // 1. Get all available translators who match the language pair
    console.log('\n🔍 Step 1: Finding Available Translators...');
    console.log(`Searching for translators with languages: [${order.source_language}, ${order.target_language}]`);
    
    const { data: availableTranslators, error: translatorsError } = await supabase
      .from('translator_profiles')
      .select('*')
      .contains('languages', [order.source_language, order.target_language]);
    
    if (translatorsError) {
      console.error('❌ Error fetching translators:', translatorsError);
      console.groupEnd();
      return [];
    }
    
    if (!availableTranslators || availableTranslators.length === 0) {
      console.log('⚠️ No translators found for this language pair');
      console.log('💡 Consider expanding language requirements or checking translator availability');
      console.groupEnd();
      return [];
    }
    
    console.log('✅ Found Translators:', {
      totalCount: availableTranslators.length,
      translators: availableTranslators.map(t => ({
        id: t.id.slice(0, 8) + '...',
        name: t.full_name,
        languages: t.languages,
        expertise: t.expertise,
        rating: t.rating,
        available: t.availability !== false
      }))
    });
    
    // 2. Get content-based recommendations
    console.log('\n🔍 Step 2: Running Content-Based Analysis...');
    const contentScores = await getContentBasedRecommendations(order, availableTranslators);
    
    // 3. Get collaborative filtering recommendations
    console.log('\n🔍 Step 3: Running Collaborative Filtering...');
    const collaborativeScores = await getCollaborativeRecommendations(order, customerId);
    
    // 4. Combine scores for hybrid approach
    console.log('\n🔍 Step 4: Combining Scores (Hybrid Approach)...');
    console.log('🧮 Hybrid Formula: 0.6 × Content Score + 0.4 × Collaborative Score');
    console.log('📊 Weight Distribution: 60% Content-Based + 40% Collaborative');
    
    const combinedScores: RecommendationScore[] = availableTranslators.map(translator => {
      const contentScore = contentScores.get(translator.id) || 0;
      const collaborativeScore = collaborativeScores.get(translator.id) || 0;
      
      // Weighted combination
      const hybridScore = 0.6 * contentScore + 0.4 * collaborativeScore;
      
      console.log(`👤 ${translator.full_name} (${translator.id.slice(0, 8)}...):`);
      console.log(`   Content Score: ${contentScore.toFixed(4)}`);
      console.log(`   Collaborative Score: ${collaborativeScore.toFixed(4)}`);
      console.log(`   Hybrid Score: 0.6 × ${contentScore.toFixed(4)} + 0.4 × ${collaborativeScore.toFixed(4)} = ${hybridScore.toFixed(4)}`);
      
      return {
        translator_id: translator.id,
        content_score: contentScore,
        collaborative_score: collaborativeScore,
        hybrid_score: hybridScore
      };
    });
    
    // 5. Sort by hybrid score (descending)
    console.log('\n🔍 Step 5: Ranking Translators...');
    combinedScores.sort((a, b) => b.hybrid_score - a.hybrid_score);
    
    console.log('📊 FINAL RANKINGS:');
    console.table(combinedScores.slice(0, 10).map((score, index) => {
      const translator = availableTranslators.find(t => t.id === score.translator_id);
      return {
        'Rank': index + 1,
        'Translator': translator?.full_name || 'Unknown',
        'ID': score.translator_id.slice(0, 8) + '...',
        'Hybrid Score': score.hybrid_score.toFixed(4),
        'Content': score.content_score.toFixed(4),
        'Collaborative': score.collaborative_score.toFixed(4),
        'Rating': translator?.rating || 'N/A'
      };
    }));
    
    // 6. Map back to full translator objects
    console.log('\n🔍 Step 6: Preparing Final Recommendations...');
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
    
    console.log('✅ Recommendations Generated:', {
      totalRecommendations: recommendedTranslators.length,
      topRecommendations: recommendedTranslators.slice(0, 5).map(t => ({
        name: t.full_name,
        hybridScore: t.recommendation_score?.toFixed(4),
        rating: t.rating
      }))
    });
    
    // Show recommendation quality analysis
    console.log('\n📈 RECOMMENDATION QUALITY ANALYSIS:');
    const hasCollaborativeData = collaborativeScores.size > 0;
    const avgHybridScore = combinedScores.reduce((sum, s) => sum + s.hybrid_score, 0) / combinedScores.length;
    const topScore = combinedScores[0]?.hybrid_score || 0;
    const scoreSpread = topScore - (combinedScores[combinedScores.length - 1]?.hybrid_score || 0);
    
    console.log('📊 Quality Metrics:', {
      hasCollaborativeData,
      averageHybridScore: avgHybridScore.toFixed(4),
      topScore: topScore.toFixed(4),
      scoreSpread: scoreSpread.toFixed(4),
      recommendationStrength: topScore > 0.5 ? 'Strong' : topScore > 0.3 ? 'Moderate' : 'Weak'
    });
    
    if (!hasCollaborativeData) {
      console.log('⚠️ Note: Recommendations are purely content-based due to lack of collaborative data');
    }
    
    console.log('🎉 Hybrid recommendation process completed successfully!');
    console.groupEnd();
    
    return recommendedTranslators;
  } catch (error) {
    console.error('❌ Error getting hybrid recommendations:', error);
    console.groupEnd();
    return [];
  }
} 
