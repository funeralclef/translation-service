"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Download, Clock, User } from "lucide-react"

interface Order {
  id: string
  customer_id: string
  source_language: string
  target_language: string
  deadline: string
  tags: string[]
  comment: string
  document_url: string
  translated_document_url?: string
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  cost: number
  created_at: string
}

interface OrderAnalysis {
  classification: string[]
  word_count: number
  complexity_score: number
  estimated_hours: number
}

interface Translator {
  id: string
  full_name: string
  languages: string[]
  expertise: string[]
  rating: number
}

interface Assignment {
  translator_id: string
  assigned_at: string
  completed_at: string | null
  translator: Translator
}

interface TranslationNote {
  order_id: string
  translator_id: string
  notes: string
  created_at: string
}

export default function OrderDetail() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClientComponentClient()

  const [order, setOrder] = useState<Order | null>(null)
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [translationNotes, setTranslationNotes] = useState<TranslationNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        // Fetch order details
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single()

        if (orderError) throw orderError

        setOrder(orderData as unknown as Order)

        // Fetch order analysis
        const { data: analysisData, error: analysisError } = await supabase
          .from("order_analysis")
          .select("*")
          .eq("order_id", orderId)
          .single()

        if (!analysisError) {
          setAnalysis(analysisData as unknown as OrderAnalysis)
        }

        // Fetch assignment and translator details if assigned
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("order_assignments")
          .select(`
            *,
            translator:translator_id (
              id,
              full_name,
              languages,
              expertise,
              rating
            )
          `)
          .eq("order_id", orderId)
          .single()

        if (!assignmentError) {
          setAssignment(assignmentData as unknown as Assignment)
        }
        
        // Fetch translator notes if available
        if (orderData.status === "completed") {
          const { data: notesData, error: notesError } = await supabase
            .from("translation_notes")
            .select("*")
            .eq("order_id", orderId)
            .single()
            
          if (!notesError && notesData) {
            setTranslationNotes(notesData as unknown as TranslationNote)
          }
        }
      } catch (error) {
        console.error("Error fetching order details:", error)
        setError("Failed to load order details")
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrderDetails()
    }
  }, [supabase, orderId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "assigned":
        return <Badge variant="secondary">Assigned</Badge>
      case "in_progress":
        return <Badge variant="default">In Progress</Badge>
      case "completed":
        return <Badge variant="success">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold">Error</h3>
          <p className="mb-6 text-sm text-muted-foreground">{error || "Order not found"}</p>
          <Button onClick={() => router.push("/dashboard/customer/orders")}>Back to Orders</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Order Details</h1>
            <p className="text-muted-foreground">Order ID: {order.id}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard/customer/orders")}>
            Back to Orders
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
              <CardDescription>Details about your translation order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Status</div>
                <div>{getStatusBadge(order.status)}</div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Document</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">{order.document_url.split("/").pop()?.split("?")[0] || "Document"}</div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={order.document_url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>

              {order.status === "completed" && order.translated_document_url && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Translated Document</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">{order.translated_document_url.split("/").pop()?.split("?")[0] || "Translated Document"}</div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={order.translated_document_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Source Language</div>
                  <div>{order.source_language}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Target Language</div>
                  <div>{order.target_language}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Timeline</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Created</div>
                    <div>{formatDate(order.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Deadline</div>
                    <div>{formatDate(order.deadline)}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="font-medium">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {order.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {order.comment && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="font-medium">Comment</div>
                    <div className="text-sm">{order.comment}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analysis</CardTitle>
                <CardDescription>Document analysis and cost breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">Word Count</div>
                        <div>{analysis.word_count}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Complexity Score</div>
                        <div>{analysis.complexity_score.toFixed(2)}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">Estimated Hours</div>
                        <div>{analysis.estimated_hours.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Cost</div>
                        <div className="font-bold">${order.cost.toFixed(2)}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">Classification</div>
                      <div className="flex flex-wrap gap-2">
                        {analysis.classification.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">No analysis data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Translator</CardTitle>
                <CardDescription>
                  {assignment ? "Assigned translator information" : "No translator assigned yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignment ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="h-10 w-10 rounded-full bg-muted p-2" />
                      <div>
                        <div className="font-medium">{assignment.translator.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Rating: {assignment.translator.rating.toFixed(1)}/100
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">Assigned</div>
                        <div>{formatDate(assignment.assigned_at)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Completed</div>
                        <div>{assignment.completed_at ? formatDate(assignment.completed_at) : "In progress"}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">Expertise</div>
                      <div className="flex flex-wrap gap-2">
                        {assignment.translator.expertise.map((exp) => (
                          <Badge key={exp} variant="secondary">
                            {exp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {translationNotes && translationNotes.notes && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="font-medium">Translator's Notes</div>
                          <div className="p-3 bg-muted rounded-md text-sm">
                            {translationNotes.notes}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    Your order is pending assignment to a translator
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
