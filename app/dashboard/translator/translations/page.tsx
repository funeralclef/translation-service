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
import { FileText, Clock, DollarSign, Star, User } from "lucide-react"

interface ActiveTranslation {
  id: string
  order_id: string
  assigned_at: string
  order?: {
    id: string
    source_language: string
    target_language: string
    deadline: string
    tags: string[]
    comment: string
    document_url: string
    status: "assigned" | "in_progress" | "completed"
    cost: number
    created_at: string
  } | null
  customer?: {
    full_name: string
    email: string
  } | null
  analysis?: {
    word_count: number
    complexity_score: number
    estimated_hours: number
    classification: string[]
  } | null
}

interface CompletedTranslation {
  id: string
  order_id: string
  completed_at: string
  customer_name: string
  source_language: string
  target_language: string
  rating: number
  feedback: string
  cost?: number
}

export default function TranslatorTranslations() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientComponentClient()

  const [activeTranslations, setActiveTranslations] = useState<ActiveTranslation[]>([])
  const [completedTranslations, setCompletedTranslations] = useState<CompletedTranslation[]>([])
  const [rating, setRating] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTranslations = async () => {
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

        // Fetch translator profile to get rating
        const { data: profile, error: profileError } = await supabase
          .from("translator_profiles")
          .select("rating")
          .eq("id", user.id)
          .single()

        if (profileError) {
          if (profileError.code === "PGRST116") {
            // Profile doesn't exist, redirect to profile creation
            router.push("/dashboard/translator/profile")
            return
          } else {
            console.error("Error fetching profile:", profileError)
            setError("Failed to load translator profile")
          }
        } else {
          setRating(profile?.rating || 0)
        }

        // Fetch active translations
        const { data: activeData, error: activeError } = await supabase
          .from("order_assignments")
          .select(`
            id,
            order_id,
            assigned_at,
            order:order_id (
              id,
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
              full_name,
              email
            )
          `)
          .eq("translator_id", user.id)
          .in("order.status", ["assigned", "in_progress"])
          .order("assigned_at", { ascending: false })

        if (activeError) {
          console.error("Error fetching active translations:", activeError)
          setError("Failed to load active translations")
        } else {
          // Filter out any translations where order is null
          const validActiveData = (activeData || []).filter((item: any) => item.order !== null)

          // Fetch analysis data for each active translation
          const translationsWithAnalysis = await Promise.all(
            validActiveData.map(async (item: any) => {
              try {
                const { data: analysisData } = await supabase
                  .from("order_analysis")
                  .select("*")
                  .eq("order_id", item.order_id)
                  .single()

                return {
                  ...item,
                  analysis: analysisData || null,
                }
              } catch (error) {
                console.error("Error fetching analysis for order:", item.order_id, error)
                return {
                  ...item,
                  analysis: null,
                }
              }
            }),
          )

          setActiveTranslations(translationsWithAnalysis)
        }

        // Fetch completed translations
        const { data: completedData, error: completedError } = await supabase
          .from("completed_translations")
          .select("*")
          .eq("translator_id", user.id)
          .order("completed_at", { ascending: false })

        if (completedError) {
          console.error("Error fetching completed translations:", completedError)
          setError("Failed to load completed translations")
        } else {
          setCompletedTranslations(completedData || [])
        }
      } catch (error) {
        console.error("Error fetching translations:", error)
        setError("An unexpected error occurred. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchTranslations()
  }, [supabase, router, user])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const renderStarRating = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating / 20) // Convert 0-100 scale to 0-5 stars
    const hasHalfStar = rating % 20 >= 10

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Star key={i} className="fill-yellow-400 text-yellow-400 h-4 w-4" />)
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<Star key={i} className="fill-yellow-400 text-yellow-400 h-4 w-4 fill-[50%]" />)
      } else {
        stars.push(<Star key={i} className="text-gray-300 h-4 w-4" />)
      }
    }

    return <div className="flex">{stars}</div>
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Translations</h1>
            <p className="text-muted-foreground">Manage your active and completed translations</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Your Rating:</div>
            <div className="flex items-center gap-1">
              <span className="font-bold">{rating}/100</span>
              {renderStarRating(rating)}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Active Translations ({activeTranslations.length}/3)</TabsTrigger>
            <TabsTrigger value="completed">Completed Translations ({completedTranslations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeTranslations.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <h3 className="mb-2 text-lg font-semibold">No active translations</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  You don't have any active translation orders at the moment.
                </p>
                <Button onClick={() => router.push("/dashboard/translator/jobs")}>Browse Available Jobs</Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeTranslations.map((translation) => (
                  <Card key={translation.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>Order #{translation.order_id.slice(0, 8)}</CardTitle>
                          <CardDescription>Assigned on {formatDate(translation.assigned_at)}</CardDescription>
                        </div>
                        {translation.order && (
                          <Badge
                            variant={translation.order.status === "in_progress" ? "default" : "secondary"}
                            className="ml-2"
                          >
                            {translation.order.status === "assigned" ? "Assigned" : "In Progress"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Customer</span>
                        </div>
                        <div className="text-sm">{translation.customer?.full_name || "Unknown Customer"}</div>
                      </div>

                      {translation.order && (
                        <>
                          <Separator />

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Deadline</span>
                            </div>
                            <div className="flex justify-between">
                              <div>{formatDate(translation.order.deadline)}</div>
                              {new Date(translation.order.deadline) < new Date() ? (
                                <Badge variant="destructive" className="ml-2">
                                  Overdue
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="ml-2">
                                  {Math.ceil(
                                    (new Date(translation.order.deadline).getTime() - new Date().getTime()) /
                                      (1000 * 60 * 60 * 24),
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
                              <div>Languages:</div>
                              <div>{`${translation.order.source_language} → ${translation.order.target_language}`}</div>
                              {translation.analysis && (
                                <>
                                  <div>Word Count:</div>
                                  <div>{translation.analysis.word_count}</div>
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
                            <div className="text-xl font-bold">${translation.order.cost.toFixed(2)}</div>
                          </div>
                        </>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        onClick={() => router.push(`/dashboard/translator/orders/${translation.order_id}`)}
                      >
                        View Details
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completedTranslations.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <h3 className="mb-2 text-lg font-semibold">No completed translations</h3>
                <p className="text-sm text-muted-foreground">You haven't completed any translation orders yet.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {completedTranslations.map((translation) => (
                  <Card key={translation.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>Order #{translation.order_id.slice(0, 8)}</CardTitle>
                          <CardDescription>Completed on {formatDate(translation.completed_at)}</CardDescription>
                        </div>
                        <Badge variant="success" className="ml-2">
                          Completed
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Customer</span>
                        </div>
                        <div className="text-sm">{translation.customer_name || "Unknown Customer"}</div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Translation Details</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Languages:</div>
                          <div>{`${translation.source_language} → ${translation.target_language}`}</div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Rating</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{translation.rating}/100</span>
                          {renderStarRating(translation.rating)}
                        </div>
                      </div>

                      {translation.feedback && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="font-medium">Customer Feedback</div>
                            <div className="text-sm italic">"{translation.feedback}"</div>
                          </div>
                        </>
                      )}

                      {translation.cost && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Payment</span>
                            </div>
                            <div className="text-xl font-bold">${translation.cost.toFixed(2)}</div>
                          </div>
                        </>
                      )}
                    </CardContent>
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
