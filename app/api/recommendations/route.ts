import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { getHybridRecommendations } from "@/utils/recommendation-system";

export async function POST(request: Request) {
  console.log('🚀 RECOMMENDATIONS API: Starting request processing');
  console.log('📍 VERCEL DEPLOYMENT NOTE: Server-side hybrid filtering logs are visible in Vercel Function Logs');
  console.log('💡 TIP: Check your Vercel dashboard > Functions tab for detailed server-side recommendation logs');
  
  try {
    const supabase = createServerComponentClient();
    const { orderId, customerId, useEmbeddings = false } = await request.json();

    if (!orderId || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: orderId or customerId" },
        { status: 400 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error("Error fetching order:", orderError);
      return NextResponse.json(
        { error: "Failed to fetch order details" },
        { status: 404 }
      );
    }

    // Get order analysis if available
    const { data: analysis, error: analysisError } = await supabase
      .from("order_analysis")
      .select("*")
      .eq("order_id", orderId)
      .single();

    // Merge order with analysis
    const orderWithAnalysis = {
      ...order,
      complexity_score: analysis?.complexity_score || 0.75,
    };

    // Get recommendations
    const recommendedTranslators = await getHybridRecommendations(
      orderWithAnalysis,
      customerId
    );

    return NextResponse.json({
      recommendedTranslators,
      recommendationCount: recommendedTranslators.length,
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      {
        error: `Failed to get recommendations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
} 