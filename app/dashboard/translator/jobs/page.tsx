"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Clock, DollarSign, AlertCircle } from "lucide-react"

interface Order {
  id: string
  customer_id: string
  source_language: string
  target_language: string
  deadline: string
  tags: string[]
  comment: string
  document_url: string
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  cost: number
  created_at: string
}

interface OrderWithAnalysis extends Order {
  analysis: {
    word_count: number
    complexity_score: number
    estimated_hours: number
  } | null
}

interface ActiveOrder extends OrderWithAnalysis {
  assigned_at: string
  customer_name: string
}

export default function TranslatorJobs() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientComponentClient()

  const [availableJobs, setAvailableJobs] = useState<OrderWithAnalysis[]>([])
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptingJob, setAcceptingJob] = useState<string | null>(null)

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        if (!user) {
          router.push("/auth/login")
          return
        }

        // Check if user role is translator
        if (user.role !== "translator") {
          router.push("/dashboard")
          return
        }

        // Fetch translator profile to get languages
        const { data: profile, error: profileError } = await supabase
          .from("translator_profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) {
          // Don't redirect, just show a message
          console.error("Error fetching profile:", profileError)
          setError("Please complete your translator profile to view available jobs")
          setLoading(false)
          return
        }

        // Fetch active orders for the translator
        const { data: activeOrdersData, error: activeOrdersError } = await supabase
          .from("order_assignments")
          .select(`
            assigned_at,
            order:order_id (
              id,
              customer_id,
              source_language,
              target_language,
              deadline,
              tags,
              comment,
              document_url,
              status,
              cost,
              created_at
            ),
            customer:customer_id (
              full_name
            )
          `)
          .eq("translator_id", user.id)
          .in("order.status", ["assigned", "in_progress"])
          .order("assigned_at", { ascending: false })

        if (activeOrdersError) {
          console.error("Error fetching active orders:", activeOrdersError)
          setError("Failed to load active orders")
        } else {
          // Transform the data to match our ActiveOrder interface
          // Filter out any null or undefined orders
          const validActiveOrders = (activeOrdersData || []).filter(
            (item) => item.order !== null && item.order !== undefined,
          )

          const transformedActiveOrders = validActiveOrders.map((item: any) => ({
            ...item.order,
            assigned_at: item.assigned_at,
            customer_name: item.customer?.full_name || "Unknown Customer",
            analysis: null, // We'll fetch this separately
          }))

          // Fetch analysis data for each active order
          const activeOrdersWithAnalysis = await Promise.all(
            transformedActiveOrders.map(async (order) => {
              try {
                const { data: analysisData } = await supabase
                  .from("order_analysis")
                  .select("*")
                  .eq("order_id", order.id)
                  .single()

                return {
                  ...order,
                  analysis: analysisData || null,
                }
              } catch (error) {
                console.error("Error fetching analysis for order:", order.id, error)
                return {
                  ...order,
                  analysis: null,
                }
              }
            }),
          )

          setActiveOrders(activeOrdersWithAnalysis)
        }

        // Only fetch available jobs if the translator has less than 3 active orders
        if (!activeOrdersData || activeOrdersData.length < 3) {
          // Fetch available jobs that match translator's languages
          const { data: ordersData, error: ordersError } = await supabase
            .from("orders")
            .select("*")
            .eq("status", "pending")
            .in("source_language", profile.languages)
            .in("target_language", profile.languages)
            .order("created_at", { ascending: false })

          if (ordersError) {
            console.error("Error fetching available jobs:", ordersError)
            setError("Failed to load available jobs")
          } else {
            // Fetch analysis data for each order
            const jobsWithAnalysis = await Promise.all(
              (ordersData || []).map(async (order) => {
                try {
                  const { data: analysisData } = await supabase
                    .from("order_analysis")
                    .select("*")
                    .eq("order_id", order.id)
                    .single()

                  return {
                    ...order,
                    analysis: analysisData || null,
                  }
                } catch (error) {
                  console.error("Error fetching analysis for order:", order.id, error)
                  return {
                    ...order,
                    analysis: null,
                  }
                }
              }),
            )

            setAvailableJobs(jobsWithAnalysis)
          }
        } else {
          // If translator already has 3 active orders, set available jobs to empty array
          setAvailableJobs([])
        }
      } catch (error) {
        console.error("Error fetching jobs:", error)
        setError("An unexpected error occurred. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [supabase, router, user])

  const acceptJob = async (jobId: string) => {
    if (activeOrders.length >= 3) {
      setError("You cannot accept more than 3 active orders at a time")
      return
    }

    setAcceptingJob(jobId)
    try {
      if (!user) {
        router.push("/auth/login")
        return
      }

      // Get customer ID for the order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("customer_id")
        .eq("id", jobId)
        .single()

      if (orderError) throw orderError

      // Create assignment
      const { error: assignmentError } = await supabase.from("order_assignments").insert({
        order_id: jobId,
        translator_id: user.id,
        customer_id: orderData.customer_id,
      })

      if (assignmentError) throw assignmentError

      // Update order status
      const { error: updateError } = await supabase.from("orders").update({ status: "assigned" }).eq("id", jobId)

      if (updateError) throw updateError

      // Remove the job from available jobs and add to active orders
      const acceptedJob = availableJobs.find((job) => job.id === jobId)
      if (acceptedJob) {
        setAvailableJobs((prev) => prev.filter((job) => job.id !== jobId))

        // Get customer name
        const { data: customerData } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", acceptedJob.customer_id)
          .single()

        const newActiveOrder: ActiveOrder = {
          ...acceptedJob,
          assigned_at: new Date().toISOString(),
          customer_name: customerData?.full_name || "Unknown Customer",
        }

        setActiveOrders((prev) => [newActiveOrder, ...prev])
      }
    } catch (error) {
      console.error("Error accepting job:", error)
      setError("Failed to accept job. Please try again.")
    } finally {
      setAcceptingJob(null)
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Translation Jobs</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Active Orders ({activeOrders.length}/3)</TabsTrigger>
            <TabsTrigger value="available">Available Jobs {activeOrders.length >= 3 && "(Limit Reached)"}</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeOrders.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <h3 className="mb-2 text-lg font-semibold">No active orders</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  You don't have any active translation orders at the moment.
                </p>
                <Button onClick={() => document.querySelector('[data-value="available"]')?.click()}>
                  Browse Available Jobs
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeOrders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>Order #{order.id ? order.id.slice(0, 8) : "Unknown"}</CardTitle>
                          <CardDescription>Assigned on {formatDate(order.assigned_at)}</CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {order.status === "assigned" ? "Assigned" : "In Progress"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Deadline</span>
                        </div>
                        <div className="flex justify-between">
                          <div>{formatDate(order.deadline)}</div>
                          {new Date(order.deadline) < new Date() ? (
                            <Badge variant="destructive" className="ml-2">
                              Overdue
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">
                              {Math.ceil(
                                (new Date(order.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                              )}{" "}
                              days left
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Translation Details</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Customer:</div>
                          <div>{order.customer_name}</div>
                          <div>Languages:</div>
                          <div>{`${order.source_language} → ${order.target_language}`}</div>
                          {order.analysis && (
                            <>
                              <div>Word Count:</div>
                              <div>{order.analysis.word_count}</div>
                            </>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Payment</span>
                        </div>
                        <div className="text-xl font-bold">${order.cost.toFixed(2)}</div>
                      </div>

                      {order.tags && order.tags.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="font-medium">Tags</div>
                            <div className="flex flex-wrap gap-2">
                              {order.tags.map((tag, index) => (
                                <Badge key={`${tag}-${index}`} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

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
                    <CardFooter className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => router.push(`/dashboard/translator/orders/${order.id}`)}
                      >
                        View Details
                      </Button>
                      {order.status === "assigned" && <Button className="flex-1">Start Working</Button>}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="mt-6">
            {activeOrders.length >= 3 ? (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have reached the maximum limit of 3 active orders. Complete some of your current orders before
                  accepting new ones.
                </AlertDescription>
              </Alert>
            ) : availableJobs.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <h3 className="mb-2 text-lg font-semibold">No available jobs</h3>
                <p className="text-sm text-muted-foreground">
                  There are currently no translation jobs matching your languages.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableJobs.map((job) => (
                  <Card key={job.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Translation Job</span>
                        <Badge variant="outline">
                          {job.source_language} → {job.target_language}
                        </Badge>
                      </CardTitle>
                      <CardDescription>Created on {formatDate(job.created_at)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Deadline</span>
                        </div>
                        <div>{formatDate(job.deadline)}</div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Document Details</span>
                        </div>
                        {job.analysis ? (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Word Count:</div>
                            <div>{job.analysis.word_count}</div>
                            <div>Complexity:</div>
                            <div>{job.analysis.complexity_score.toFixed(2)}</div>
                            <div>Est. Hours:</div>
                            <div>{job.analysis.estimated_hours.toFixed(2)}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Analysis not available</div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Payment</span>
                        </div>
                        <div className="text-xl font-bold">${job.cost.toFixed(2)}</div>
                      </div>

                      {job.tags && job.tags.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="font-medium">Tags</div>
                            <div className="flex flex-wrap gap-2">
                              {job.tags.map((tag, index) => (
                                <Badge key={`${tag}-${index}`} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {job.comment && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="font-medium">Customer Comment</div>
                            <div className="text-sm">{job.comment}</div>
                          </div>
                        </>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        onClick={() => acceptJob(job.id)}
                        disabled={acceptingJob === job.id || activeOrders.length >= 3}
                      >
                        {acceptingJob === job.id ? "Accepting..." : "Accept Job"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
