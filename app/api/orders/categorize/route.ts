import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = createServerComponentClient()
    const { searchParams } = new URL(request.url)
    
    // Get query parameters
    const tags = searchParams.get('tags')?.split(',') || []
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Build the query
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customer_id (
          id,
          full_name,
          email
        ),
        translator:translator_id (
          id,
          full_name,
          email
        ),
        analysis:document_analysis (
          classification,
          word_count,
          complexity_score,
          estimated_hours,
          cost
        )
      `)
    
    // Apply tag filtering if provided
    if (tags.length > 0) {
      // Filter orders that contain ANY of the provided tags
      query = query.contains('tags', tags)
    }
    
    // Apply status filtering if provided
    if (status) {
      query = query.eq('status', status)
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false })
    
    // Execute the query
    const { data: orders, error, count } = await query
    
    if (error) {
      console.error("Error fetching orders:", error)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }
    
    // Get distinct tags across all orders
    const { data: tagsData, error: tagsError } = await supabase
      .from('orders')
      .select('tags')
    
    if (tagsError) {
      console.error("Error fetching tags:", tagsError)
      // Continue with the response even if tag fetching fails
    }
    
    // Extract and count unique tags
    const tagCounts: Record<string, number> = {}
    if (tagsData) {
      tagsData.forEach(order => {
        if (order.tags && Array.isArray(order.tags)) {
          order.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        }
      })
    }
    
    // Sort tags by count (descending)
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }))
    
    return NextResponse.json({
      orders: orders || [],
      tags: sortedTags,
      total: count || 0
    })
  } catch (error) {
    console.error("Error categorizing orders:", error)
    return NextResponse.json({ error: "Failed to categorize orders" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerComponentClient()
    const { orderId, tags } = await request.json()
    
    if (!orderId || !tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: "Missing required fields: orderId or tags" },
        { status: 400 }
      )
    }
    
    // Update the order tags
    const { error } = await supabase
      .from('orders')
      .update({ tags })
      .eq('id', orderId)
    
    if (error) {
      console.error("Error updating order tags:", error)
      return NextResponse.json({ error: "Failed to update order tags" }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating order tags:", error)
    return NextResponse.json({ error: "Failed to update order tags" }, { status: 500 })
  }
} 