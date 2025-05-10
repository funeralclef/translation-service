"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Download, Clock, User, AlertCircle, Loader2 } from "lucide-react"

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

interface Customer {
  id: string
  full_name: string
  email: string
}

interface Translator {
  id: string
  full_name: string
  languages: string[]
  expertise: string[]
  rating: number
}

interface Assignment {
  id: string
  order_id: string
  translator_id: string
  customer_id: string
  assigned_at: string
  translator?: Translator
}

interface OrderAnalysis {
  id: string
  order_id: string
  classification: string[]
  word_count: number
  complexity_score: number
  estimated_hours: number
}

export default function AdminOrderDetail() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { user } = useAuth()
  const supabase = createClientComponentClient()

  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null)
  const [availableTranslators, setAvailableTranslators] = useState<Translator[]>([])
  const [selectedTranslator, setSelectedTranslator] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        if (!user || user.role !== "admin") {
          router.push("/dashboard")
          return
        }

        // Fetch order details
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single()

        if (orderError) throw orderError

        setOrder(orderData)

        // Fetch customer details
        const { data: customerData, error: customerError } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("id", orderData.customer_id)
          .single()

        if (!customerError) {
          setCustomer(customerData)
        }

        // Fetch assignment and translator details if assigned
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("order_assignments")
          .select("*")
          .eq("order_id", orderId)
          .single()

        if (!assignmentError && assignmentData) {
          // Fetch translator details
          const { data: translatorData, error: translatorError } = await supabase
            .from("translator_profiles")
            .select("*")
            .eq("id", assignmentData.translator_id)
            .single()

          if (!translatorError) {
            // Get translator name from users table
            const { data: translatorUserData } = await supabase
              .from("users")
              .select("full_name")
              .eq("id", assignmentData.translator_id)
              .single()

            setAssignment({
              ...assignmentData,
              translator: {
                ...translatorData,
                full_name: translatorUserData?.full_name || "Unknown",
              },
            })
          } else {
            setAssignment(assignmentData)
          }
        }

        // Fetch order analysis
        const { data: analysisData, error: analysisError } = await supabase
          .from("order_analysis")
          .select("*")
          .eq("order_id", orderId)
          .single()

        if (!analysisError) {
          setAnalysis(analysisData)
        }

        // Fetch available translators if order is pending
        if (orderData.status === "pending") {
          const { data: translatorsData, error: translatorsError } = await supabase
            .from("translator_profiles")
            .select("*")
            .contains("languages", [orderData.source_language, orderData.target_language])

          if (!translatorsError && translatorsData) {
            // Get translator names from users table
            const translatorIds = translatorsData.map((t) => t.id)
            const { data: translatorUsersData } = await supabase
              .from("users")
              .select("id, full_name")
              .in("id", translatorIds)

            // Combine data
            const enrichedTranslators = translatorsData.map((translator) => {
              const userData = translatorUsersData?.find((u) => u.id === translator.id)
              return {
                ...translator,
                full_name: userData?.full_name || "Unknown",
              }
            })

            setAvailableTranslators(enrichedTranslators)
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
  }, [supabase, orderId, router, user])

  const assignTranslator = async () => {
    if (!order || !selectedTranslator) return

    try {
      setActionLoading(true)
      setError(null)
      setSuccess(null)

      // Check if order already has an assignment
      if (assignment) {
        // Update existing assignment
        const { error: updateError } = await supabase
          .from("order_assignments")
          .update({
            translator_id: selectedTranslator,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", assignment.id)

        if (updateError) throw updateError
      } else {
        // Create new assignment
        const { error: insertError } = await supabase.from("order_assignments").insert({
          order_id: order.id,
          translator_id: selectedTranslator,
          customer_id: order.customer_id,
        })

        if (insertError) throw insertError
      }

      // Update order status
      const { error: updateError } = await supabase.from("orders").update({ status: "assigned" }).eq("id", order.id)

      if (updateError) throw updateError

      // Get translator details
      const { data: translatorData, error: translatorError } = await supabase
        .from("translator_profiles")
        .select("*")
        .eq("id", selectedTranslator)
        .single()

      if (translatorError) throw translatorError

      // Get translator name
      const { data: translatorUserData, error: translatorUserError } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", selectedTranslator)
        .single()

      if (translatorUserError) throw translatorUserError

      // Update local state
      setOrder({ ...order, status: "assigned" })
      setAssignment({
        id: assignment?.id || "",
        order_id: order.id,
        translator_id: selectedTranslator,
        customer_id: order.customer_id,
        assigned_at: new Date().toISOString(),
        translator: {
          ...translatorData,
          full_name: translatorUserData.full_name,
        },
      })

      setSuccess("Translator assigned successfully")
    } catch (error) {
      console.error("Error assigning translator:", error)
      setError("Failed to assign translator")
    } finally {
      setActionLoading(false)
    }
  }

  const cancelOrder = async () => {
    if (!order) return

    try {
      setActionLoading(true)
      setError(null)
      setSuccess(null)

      // Update order status
      const { error: updateError } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id)

      if (updateError) throw updateError

      // Update local state
      setOrder({ ...order, status: "cancelled" })
      setSuccess("Order cancelled successfully")
    } catch (error) {
      console.error("Error cancelling order:", error)
      setError("Failed to cancel order")
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

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
          <Button onClick={() => router.push("/dashboard/admin/orders")}>Back to Orders</Button>
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
          <Button variant="outline" onClick={() => router.push("/dashboard/admin/orders")}>
            Back to Orders
          </Button>
        </div>

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Order Information</CardTitle>
                {getStatusBadge(order.status)}
              </div>
              <CardDescription>Details about the translation order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Customer</span>
                </div>
                {customer ? (
                  <div className="text-sm">
                    <div className="font-medium">{customer.full_name}</div>
                    <div className="text-muted-foreground">{customer.email}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Customer information not available</div>
                )}
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

              {order.translated_document_url && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Translated Document</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        {order.translated_document_url.split("/").pop()?.split("?")[0] || "Translated Document"}
                      </div>
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
                    <div className="flex items-center">
                      {formatDate(order.deadline)}
                      {new Date(order.deadline) < new Date() && (
                        <Badge variant="destructive" className="ml-2">
                          Overdue
                        </Badge>
                      )}
                    </div>
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
                    <div className="font-medium">Customer Comment</div>
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
              <CardContent className="space-y-4">
                {assignment?.translator ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="h-10 w-10 rounded-full bg-muted p-2" />
                      <div>
                        <div className="font-medium">{assignment.translator.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Rating: {assignment.translator.rating.toFixed(1)}/5.0
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">Assigned</div>
                        <div>{formatDate(assignment.assigned_at)}</div>
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
                  </div>
                ) : order.status === "pending" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="font-medium">Assign Translator</div>
                      <Select value={selectedTranslator} onValueChange={setSelectedTranslator}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a translator" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTranslators.map((translator) => (
                            <SelectItem key={translator.id} value={translator.id}>
                              {translator.full_name} - Rating: {translator.rating.toFixed(1)}/5.0
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={assignTranslator}
                      disabled={!selectedTranslator || actionLoading}
                      className="w-full"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        "Assign Translator"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {order.status === "cancelled"
                      ? "This order has been cancelled"
                      : "No translator information available"}
                  </div>
                )}
              </CardContent>
            </Card>

            {order.status !== "cancelled" && order.status !== "completed" && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>Manage this order</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Be careful when cancelling orders. This action cannot be undone.
                    </AlertDescription>
                  </Alert>

                  <Button variant="destructive" onClick={cancelOrder} disabled={actionLoading} className="w-full">
                    {actionLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Cancel Order"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
