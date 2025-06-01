"use client"

import { useState, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import { formatEstimatedTime, formatEstimatedTimeCompact } from "@/utils/time-formatting"
import { formatComplexity } from "@/utils/complexity-formatting"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Clock, DollarSign, AlertCircle, Loader2, Star, User } from "lucide-react"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"

// Add success variant to Badge
declare module "@/components/ui/badge" {
  interface BadgeProps {
    variant?: "default" | "destructive" | "outline" | "secondary" | "success";
  }
}

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

interface AssignmentRequest {
  id: string
  order_id: string
  assigned_at: string
  order: Order
  customer: {
    full_name: string
  }
  analysis: {
    word_count: number
    complexity_score: number
    estimated_hours: number
  } | null
}

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
  document_url?: string
  translated_document_url?: string
  tags?: string[]
  comment?: string
  deadline?: string
  word_count?: number
  complexity_score?: number
  estimated_hours?: number
  classification?: string[]
}

// Types for database responses
interface OrderData {
  cost: number;
  document_url: string;
  translated_document_url: string;
  tags: string[];
  comment: string;
  deadline: string;
}

interface AnalysisData {
  word_count: number;
  complexity_score: number;
  estimated_hours: number;
  classification: string[];
}

interface CompletedTranslationResponse {
  id: string;
  order_id: string;
  translator_id: string;
  customer_id: string;
  completed_at: string;
  customer_name: string;
  source_language: string;
  target_language: string;
  rating: number;
  feedback: string;
}

// Interface for translator profile
interface TranslatorProfile {
  id: string;
  languages: string[];
  rating: number;
}

export default function TranslatorJobs() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientComponentClient()
  const { t } = useLanguage()

  const [availableJobs, setAvailableJobs] = useState<OrderWithAnalysis[]>([])
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [assignmentRequests, setAssignmentRequests] = useState<AssignmentRequest[]>([])
  const [activeTranslations, setActiveTranslations] = useState<ActiveTranslation[]>([])
  const [completedTranslations, setCompletedTranslations] = useState<CompletedTranslation[]>([])
  const [rating, setRating] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptingJob, setAcceptingJob] = useState<string | null>(null)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("available")

  // Check for tab query parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const query = new URLSearchParams(window.location.search);
      const tab = query.get('tab');
      if (tab && ['available', 'requests', 'active', 'completed'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

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

        // Fetch translator profile to get languages and rating
        const { data: profileData, error: profileError } = await supabase
          .from("translator_profiles")
          .select("languages, rating")
          .eq("id", user.id)
          .single()

        if (profileError) {
          // Don't redirect, just show a message
          console.error("Error fetching profile:", profileError)
          setError("Please complete your translator profile to view available jobs")
          setLoading(false)
          return
        }
        
        // Cast profile data to ensure correct typing
        const profile = profileData as TranslatorProfile;
        
        // Set translator rating
        setRating(profile.rating || 0)

        // Fetch assignment requests for the translator
        const { data: requestsData, error: requestsError } = await supabase
          .from("order_assignments")
          .select(`
            id,
            order_id,
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
          .eq("status", "requested")
          .order("assigned_at", { ascending: false })

        if (requestsError) {
          console.error("Error fetching assignment requests:", requestsError)
        } else {
          // Filter out any null orders
          const validRequests = (requestsData || []).filter(
            (item) => item.order !== null && item.order !== undefined
          )

          // Fetch analysis data for each request
          const requestsWithAnalysis = await Promise.all(
            validRequests.map(async (item: any) => {
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
                console.error("Error fetching analysis for request:", item.order_id, error)
                return {
                  ...item,
                  analysis: null,
                }
              }
            })
          )

          setAssignmentRequests(requestsWithAnalysis as AssignmentRequest[])
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

          setActiveOrders(activeOrdersWithAnalysis as ActiveOrder[])
        }

        // Only fetch available jobs if the translator has less than 3 active orders
        if (!activeOrdersData || activeOrdersData.length < 3) {
          // Fetch available jobs that match translator's languages
          const { data: ordersData, error: ordersError } = await supabase
            .from("orders")
            .select("*")
            .eq("status", "pending")
            .in("source_language", profile.languages as string[])
            .in("target_language", profile.languages as string[])
            .order("created_at", { ascending: false })

          if (ordersError) {
            console.error("Error fetching available jobs:", ordersError)
            setError("Failed to load available jobs")
          } else {
            // Fetch analysis data for each order
            const jobsWithAnalysis = await Promise.all(
              (ordersData || []).map(async (order: any) => {
                try {
                  const { data: analysisData } = await supabase
                    .from("order_analysis")
                    .select("*")
                    .eq("order_id", order.id)
                    .single()

                  return {
                    ...order,
                    analysis: analysisData || null,
                  } as OrderWithAnalysis
                } catch (error) {
                  console.error("Error fetching analysis for order:", order.id, error)
                  return {
                    ...order,
                    analysis: null,
                  } as OrderWithAnalysis
                }
              }),
            )

            setAvailableJobs(jobsWithAnalysis)
          }
        } else {
          // If translator already has 3 active orders, set available jobs to empty array
          setAvailableJobs([])
        }
        
        // Fetch active translations for My Translations section
        const { data: activeTransData, error: activeTransError } = await supabase
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

        if (activeTransError) {
          console.error("Error fetching active translations:", activeTransError)
        } else {
          // Filter out any translations where order is null
          const validActiveData = (activeTransData || []).filter((item: any) => item.order !== null)

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

          setActiveTranslations(translationsWithAnalysis as ActiveTranslation[])
        }

        // Fetch completed translations with enhanced data
        const { data: completedData, error: completedError } = await supabase
          .from("completed_translations")
          .select(`
            id,
            order_id,
            translator_id,
            customer_id,
            completed_at,
            customer_name,
            source_language,
            target_language,
            rating,
            feedback
          `)
          .eq("translator_id", user.id)
          .order("completed_at", { ascending: false })

        if (completedError) {
          console.error("Error fetching completed translations:", completedError)
        } else {
          // Now get related order information for each order
          const enhancedCompletedData: CompletedTranslation[] = [];
          
          for (const translation of completedData || []) {
            const item = translation as CompletedTranslationResponse;
            
            // Get order details
            const { data: orderData } = await supabase
              .from("orders")
              .select("cost, document_url, translated_document_url, tags, comment, deadline")
              .eq("id", item.order_id)
              .single();
              
            // Get order analysis
            const { data: analysisData } = await supabase
              .from("order_analysis")
              .select("word_count, complexity_score, estimated_hours, classification")
              .eq("order_id", item.order_id)
              .single();
              
            enhancedCompletedData.push({
              id: item.id,
              order_id: item.order_id,
              completed_at: item.completed_at,
              customer_name: item.customer_name,
              source_language: item.source_language,
              target_language: item.target_language,
              rating: item.rating,
              feedback: item.feedback,
              cost: (orderData as OrderData | null)?.cost,
              document_url: (orderData as OrderData | null)?.document_url,
              translated_document_url: (orderData as OrderData | null)?.translated_document_url,
              tags: (orderData as OrderData | null)?.tags,
              comment: (orderData as OrderData | null)?.comment,
              deadline: (orderData as OrderData | null)?.deadline,
              word_count: (analysisData as AnalysisData | null)?.word_count,
              complexity_score: (analysisData as AnalysisData | null)?.complexity_score,
              estimated_hours: (analysisData as AnalysisData | null)?.estimated_hours,
              classification: (analysisData as AnalysisData | null)?.classification
            });
          }
          
          setCompletedTranslations(enhancedCompletedData);
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
          customer_name: customerData?.full_name as string || "Unknown Customer",
          status: "assigned",
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

  const acceptRequest = async (requestId: string, orderId: string) => {
    if (activeOrders.length >= 3) {
      setError(t("translatorJobs.requests.errorMaxActiveOrders"))
      return
    }

    setProcessingRequest(requestId)
    try {
      // Update assignment status
      const { error: updateAssignmentError } = await supabase
        .from("order_assignments")
        .update({ status: null }) // Remove the "requested" status
        .eq("id", requestId)

      if (updateAssignmentError) throw updateAssignmentError

      // Update order status
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({ status: "assigned" })
        .eq("id", orderId)

      if (updateOrderError) throw updateOrderError

      // Update UI
      const acceptedRequest = assignmentRequests.find(req => req.id === requestId)
      if (acceptedRequest) {
        // Remove from requests
        setAssignmentRequests(prev => prev.filter(req => req.id !== requestId))

        // Add to active orders
        const newActiveOrder: ActiveOrder = {
          ...acceptedRequest.order,
          assigned_at: acceptedRequest.assigned_at,
          customer_name: acceptedRequest.customer?.full_name || "Unknown Customer",
          analysis: acceptedRequest.analysis,
          status: "assigned"
        }
        
        setActiveOrders(prev => [newActiveOrder, ...prev])
      }
    } catch (error) {
      console.error("Error accepting request:", error)
      setError(t("translatorJobs.requests.errorAcceptRequest"))
    } finally {
      setProcessingRequest(null)
    }
  }

  const declineRequest = async (requestId: string) => {
    setProcessingRequest(requestId)
    try {
      // Delete the assignment request
      const { error: deleteError } = await supabase
        .from("order_assignments")
        .delete()
        .eq("id", requestId)

      if (deleteError) throw deleteError

      // Update UI
      setAssignmentRequests(prev => prev.filter(req => req.id !== requestId))
    } catch (error) {
      console.error("Error declining request:", error)
      setError(t("translatorJobs.requests.errorDeclineRequest"))
    } finally {
      setProcessingRequest(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDeadline = (deadlineString: string) => {
    const deadline = new Date(deadlineString)
    const now = new Date()
    const diffTime = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return (
        <span className="text-destructive font-medium">
          Overdue by {Math.abs(diffDays)} {Math.abs(diffDays) === 1 ? "day" : "days"}
        </span>
      )
    } else if (diffDays === 0) {
      return <span className="text-destructive font-medium">Due today</span>
    } else if (diffDays === 1) {
      return <span className="text-amber-500 font-medium">Due tomorrow</span>
    } else if (diffDays <= 3) {
      return <span className="text-amber-500 font-medium">Due in {diffDays} days</span>
    } else {
      return <span>Due in {diffDays} days</span>
    }
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">{t("translatorJobs.title")}</h1>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">{t("translatorJobs.yourRating")}</div>
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

        <Tabs defaultValue="available" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="available">{t("translatorJobs.tabs.available")}</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              {t("translatorJobs.tabs.requests")}
              {assignmentRequests.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {assignmentRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">{t("translatorJobs.tabs.active")}</TabsTrigger>
            <TabsTrigger value="completed">{t("translatorJobs.tabs.completed")}</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">{t("translatorJobs.available.title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("translatorJobs.available.description")}</p>
                </div>
                <Badge variant="outline">{availableJobs.length} {t("translatorJobs.available.jobsCount")}</Badge>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">{t("translatorJobs.available.loadingJobs")}</p>
                  </div>
                </div>
              ) : availableJobs.length === 0 ? (
                <div className="flex h-auto flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-2">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{t("translatorJobs.available.noJobs")}</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-4">
                    {activeOrders.length >= 3
                      ? t("translatorJobs.available.maxOrdersReached")
                      : t("translatorJobs.available.noJobsDescription")}
                  </p>
                  <Button onClick={() => router.refresh()} variant="outline" size="sm" className="flex items-center gap-1">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                      <path d="M1.90321 7.29033C1.90321 10.2387 4.29483 12.6303 7.24321 12.6303C10.1916 12.6303 12.5832 10.2387 12.5832 7.29033C12.5832 4.34194 10.1916 1.95033 7.24321 1.95033C6.01393 1.95033 4.87866 2.37077 3.97909 3.06248L4.71453 3.79792C5.45211 3.27853 6.31883 2.95033 7.24321 2.95033C9.64049 2.95033 11.5832 4.89304 11.5832 7.29033C11.5832 9.68761 9.64049 11.6303 7.24321 11.6303C4.84593 11.6303 2.90321 9.68761 2.90321 7.29033C2.90321 6.36595 3.23142 5.49923 3.7508 4.76165L3.01536 4.02621C2.32366 4.92578 1.90321 6.06105 1.90321 7.29033ZM5.58593 4.79031L3.15469 4.21228L2.57666 6.64352L5.58593 4.79031Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                    </svg>
                    {t("translatorJobs.available.refreshJobs")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative mb-6">
                    <Carousel
                      opts={{
                        align: "start",
                        loop: true,
                        dragFree: true,
                        skipSnaps: true,
                        slidesToScroll: 1,
                        breakpoints: {
                          '(min-width: 640px)': { slidesToScroll: 1 },
                          '(min-width: 768px)': { slidesToScroll: 2 },
                          '(min-width: 1024px)': { slidesToScroll: 3 },
                        }
                      }}
                      className="mx-auto max-w-[95%] px-4"
                    >
                      <CarouselContent>
                        {availableJobs.map((job) => (
                          <CarouselItem key={job.id} className="sm:basis-full md:basis-1/2 lg:basis-1/3">
                            <Card className="overflow-hidden transition-all hover:shadow-md h-full">
                              <CardHeader>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <CardTitle className="text-md break-words">{job.tags.slice(0, 3).join(", ")}</CardTitle>
                                    <CardDescription>{t("translatorJobs.available.createdOn")} {formatDate(job.created_at)}</CardDescription>
                                  </div>
                                  <Badge variant="secondary" className="ml-2 shrink-0">
                                    {job.source_language} → {job.target_language}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{t("translatorJobs.available.deadline")}</span>
                                  </div>
                                  <div className="text-sm">{formatDeadline(job.deadline)}</div>
                                </div>

                                <Separator />

                                {job.analysis && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="font-medium">{t("translatorJobs.available.jobDetails")}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>{t("translatorJobs.available.wordCount")}</div>
                                      <div>{job.analysis.word_count}</div>
                                      <div>{t("translatorJobs.available.complexity")}</div>
                                      <div>{formatComplexity(job.analysis.complexity_score)}</div>
                                      <div>{t("translatorJobs.available.estimatedHours")}</div>
                                      <div>{job.analysis.estimated_hours ? formatEstimatedTimeCompact(job.analysis.estimated_hours) : "N/A"}</div>
                                    </div>
                                  </div>
                                )}

                                {job.comment && (
                                  <>
                                    <Separator />
                                    <div className="space-y-2">
                                      <div className="font-medium">{t("translatorJobs.available.comment")}</div>
                                      <div className="text-sm rounded bg-muted px-3 py-2 break-words">
                                        <p className="line-clamp-2">{job.comment}</p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                <Separator />

                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{t("translatorJobs.available.payment")}</span>
                                  </div>
                                  <div className="text-xl font-bold">${job.cost.toFixed(2)}</div>
                                </div>
                              </CardContent>
                              <CardFooter>
                                <Button
                                  onClick={() => acceptJob(job.id)}
                                  className="w-full"
                                  disabled={acceptingJob === job.id}
                                >
                                  {acceptingJob === job.id ? (
                                    <>
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1"></div>
                                      {t("translatorJobs.available.processing")}
                                    </>
                                  ) : (
                                    t("translatorJobs.available.acceptJob")
                                  )}
                                </Button>
                              </CardFooter>
                            </Card>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <div className="flex justify-center gap-2 mt-4">
                        <CarouselPrevious className="static translate-y-0 translate-x-0" />
                        <CarouselNext className="static translate-y-0 translate-x-0" />
                      </div>
                    </Carousel>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">{t("translatorJobs.requests.title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("translatorJobs.requests.description")}</p>
                </div>
                <Badge variant="outline">{assignmentRequests.length} {t("translatorJobs.requests.requestsCount")}</Badge>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">{t("translatorJobs.requests.loadingRequests")}</p>
                  </div>
                </div>
              ) : assignmentRequests.length === 0 ? (
                <div className="flex h-auto flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-2">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{t("translatorJobs.requests.noRequests")}</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-4">
                    {t("translatorJobs.requests.noRequestsDescription")}
                  </p>
                  <Button onClick={() => router.refresh()} variant="outline" size="sm" className="flex items-center gap-1">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                      <path d="M1.90321 7.29033C1.90321 10.2387 4.29483 12.6303 7.24321 12.6303C10.1916 12.6303 12.5832 10.2387 12.5832 7.29033C12.5832 4.34194 10.1916 1.95033 7.24321 1.95033C6.01393 1.95033 4.87866 2.37077 3.97909 3.06248L4.71453 3.79792C5.45211 3.27853 6.31883 2.95033 7.24321 2.95033C9.64049 2.95033 11.5832 4.89304 11.5832 7.29033C11.5832 9.68761 9.64049 11.6303 7.24321 11.6303C4.84593 11.6303 2.90321 9.68761 2.90321 7.29033C2.90321 6.36595 3.23142 5.49923 3.7508 4.76165L3.01536 4.02621C2.32366 4.92578 1.90321 6.06105 1.90321 7.29033ZM5.58593 4.79031L3.15469 4.21228L2.57666 6.64352L5.58593 4.79031Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                    </svg>
                    {t("translatorJobs.requests.refreshRequests")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative mb-6">
                    <Carousel
                      opts={{
                        align: "start",
                        loop: true,
                        dragFree: true,
                        skipSnaps: true,
                        slidesToScroll: 1,
                        breakpoints: {
                          '(min-width: 640px)': { slidesToScroll: 1 },
                          '(min-width: 768px)': { slidesToScroll: 2 },
                          '(min-width: 1024px)': { slidesToScroll: 3 },
                        }
                      }}
                      className="mx-auto max-w-[95%] px-4"
                    >
                      <CarouselContent>
                        {assignmentRequests.map((request) => (
                          <CarouselItem key={request.id} className="sm:basis-full md:basis-1/2 lg:basis-1/3">
                            <Card className="overflow-hidden transition-all hover:shadow-md h-full">
                              <CardHeader>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <CardTitle className="text-md break-words">{t("translatorJobs.requests.requestFrom").replace("{name}", request.customer.full_name)}</CardTitle>
                                    <CardDescription>{t("translatorJobs.requests.requestedOn")} {formatDate(request.assigned_at)}</CardDescription>
                                  </div>
                                  <Badge variant="secondary" className="ml-2 shrink-0">
                                    {request.order.source_language} → {request.order.target_language}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{t("translatorJobs.available.deadline")}</span>
                                  </div>
                                  <div className="text-sm">{formatDeadline(request.order.deadline)}</div>
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{t("translatorJobs.available.jobDetails")}</span>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1 my-2">
                                    {request.order.tags.slice(0, 3).map((tag, i) => (
                                      <Badge key={i} variant="outline">{tag}</Badge>
                                    ))}
                                    {request.order.tags.length > 3 && (
                                      <span className="text-xs text-muted-foreground">{t("translatorJobs.requests.moreItems").replace("{count}", (request.order.tags.length - 3).toString())}</span>
                                    )}
                                  </div>

                                  {request.analysis && (
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>{t("translatorJobs.available.wordCount")}</div>
                                      <div>{request.analysis.word_count}</div>
                                      <div>{t("translatorJobs.available.complexity")}</div>
                                      <div>{formatComplexity(request.analysis.complexity_score)}</div>
                                      <div>{t("translatorJobs.available.estimatedHours")}</div>
                                      <div>{request.analysis.estimated_hours ? formatEstimatedTimeCompact(request.analysis.estimated_hours) : "N/A"}</div>
                                    </div>
                                  )}
                                </div>

                                {request.order.comment && (
                                  <>
                                    <Separator />
                                    <div className="space-y-2">
                                      <div className="font-medium">{t("translatorJobs.available.comment")}</div>
                                      <div className="text-sm rounded bg-muted px-3 py-2 break-words">
                                        <p className="line-clamp-2">{request.order.comment}</p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                <Separator />

                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{t("translatorJobs.available.payment")}</span>
                                  </div>
                                  <div className="text-xl font-bold">${request.order.cost.toFixed(2)}</div>
                                </div>
                              </CardContent>
                              <CardFooter className="flex flex-col gap-3">
                                <Button
                                    onClick={() => router.push(`/dashboard/translator/orders/${request.order_id}`)}
                                    variant="secondary"
                                    className="w-full"
                                >
                                  {t("translatorJobs.requests.viewDetails")}
                                </Button>
                                <div className="flex w-full gap-3">
                                  <Button
                                    onClick={() => acceptRequest(request.id, request.order_id)}
                                    className="flex-1"
                                    disabled={processingRequest === request.id || activeOrders.length >= 3}
                                  >
                                    {processingRequest === request.id ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("translatorJobs.available.processing")}
                                      </>
                                    ) : (
                                      t("translatorJobs.requests.accept")
                                    )}
                                  </Button>
                                  <Button
                                    onClick={() => declineRequest(request.id)}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={processingRequest === request.id}
                                  >
                                    {t("translatorJobs.requests.decline")}
                                  </Button>
                                </div>
                              </CardFooter>
                            </Card>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <div className="flex justify-center gap-2 mt-4">
                        <CarouselPrevious className="static translate-y-0 translate-x-0" />
                        <CarouselNext className="static translate-y-0 translate-x-0" />
                      </div>
                    </Carousel>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">{t("translatorJobs.active.title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("translatorJobs.active.description")}</p>
                </div>
                <Badge variant="outline">{activeOrders.length} {t("translatorJobs.active.ordersCount")}</Badge>
              </div>
              
              {activeOrders.length === 0 ? (
                <div className="flex h-auto flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-2">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{t("translatorJobs.active.noActiveOrders")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("translatorJobs.active.noActiveOrdersDescription")}
                  </p>
                  <Button onClick={() => setActiveTab("available")}>{t("translatorJobs.active.browseAvailableJobs")}</Button>
                </div>
              ) : (
                <div className="relative mb-6">
                  <Carousel
                    opts={{
                      align: "start",
                      loop: true,
                      dragFree: true,
                      skipSnaps: true,
                      slidesToScroll: 1,
                      breakpoints: {
                        '(min-width: 640px)': { slidesToScroll: 1 },
                        '(min-width: 768px)': { slidesToScroll: 2 },
                        '(min-width: 1024px)': { slidesToScroll: 3 },
                      }
                    }}
                    className="mx-auto max-w-[95%] px-4"
                  >
                    <CarouselContent>
                      {activeOrders.map((order) => (
                        <CarouselItem key={order.id} className="sm:basis-full md:basis-1/2 lg:basis-1/3">
                          <Card className="overflow-hidden transition-all hover:shadow-md h-full">
                            <CardHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-md break-words">{t("translatorJobs.active.orderNumber").replace("{id}", order.id.slice(0, 8))}</CardTitle>
                                  <CardDescription>{t("translatorJobs.active.assignedOn")} {formatDate(order.assigned_at)}</CardDescription>
                                </div>
                                <Badge variant="secondary" className="ml-2 shrink-0">
                                  {order.source_language} → {order.target_language}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{t("translatorJobs.active.customer")}</span>
                                </div>
                                <div className="text-sm">{order.customer_name}</div>
                              </div>

                              <Separator />

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{t("translatorJobs.available.deadline")}</span>
                                </div>
                                <div className="text-sm">{formatDeadline(order.deadline)}</div>
                              </div>

                              <Separator />

                              {order.analysis && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{t("translatorJobs.available.jobDetails")}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>{t("translatorJobs.available.wordCount")}</div>
                                    <div>{order.analysis.word_count}</div>
                                    <div>{t("translatorJobs.available.complexity")}</div>
                                    <div>{formatComplexity(order.analysis.complexity_score)}</div>
                                    <div>{t("translatorJobs.available.estimatedHours")}</div>
                                    <div>{order.analysis.estimated_hours ? formatEstimatedTimeCompact(order.analysis.estimated_hours) : "N/A"}</div>
                                  </div>
                                </div>
                              )}

                              <Separator />

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{t("translatorJobs.available.payment")}</span>
                                </div>
                                <div className="text-xl font-bold">${order.cost.toFixed(2)}</div>
                              </div>
                            </CardContent>
                            <CardFooter>
                              <Button
                                className="w-full"
                                onClick={() => router.push(`/dashboard/translator/orders/${order.id}`)}
                              >
                                {t("translatorJobs.active.viewOrder")}
                              </Button>
                            </CardFooter>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <div className="flex justify-center gap-2 mt-4">
                      <CarouselPrevious className="static translate-y-0 translate-x-0" />
                      <CarouselNext className="static translate-y-0 translate-x-0" />
                    </div>
                  </Carousel>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="completed" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">{t("translatorJobs.completed.title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("translatorJobs.completed.description")}</p>
                </div>
                <Badge variant="outline">{completedTranslations.length} {t("translatorJobs.completed.translationsCount")}</Badge>
              </div>
              
              {completedTranslations.length === 0 ? (
                <div className="flex h-auto flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-2">
                    <Star className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{t("translatorJobs.completed.noCompletedTranslations")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t("translatorJobs.completed.noCompletedTranslationsDescription")}</p>
                </div>
              ) : (
                <div className="relative mb-6">
                  <Carousel
                    opts={{
                      align: "start",
                      loop: true,
                      dragFree: true,
                      skipSnaps: true,
                      slidesToScroll: 1,
                      breakpoints: {
                        '(min-width: 640px)': { slidesToScroll: 1 },
                        '(min-width: 768px)': { slidesToScroll: 2 },
                        '(min-width: 1024px)': { slidesToScroll: 3 },
                      }
                    }}
                    className="mx-auto max-w-[95%] px-4"
                  >
                    <CarouselContent>
                      {completedTranslations.map((translation) => (
                        <CarouselItem key={translation.id} className="sm:basis-full md:basis-1/2 lg:basis-1/3">
                          <Card className="overflow-hidden transition-all hover:shadow-md h-full">
                            <CardHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-md break-words">{t("translatorJobs.active.orderNumber").replace("{id}", translation.order_id.slice(0, 8))}</CardTitle>
                                  <CardDescription>{t("translatorJobs.completed.completedOn")} {formatDate(translation.completed_at)}</CardDescription>
                                </div>
                                <Badge variant="secondary" className="ml-2 shrink-0">
                                  {translation.source_language} → {translation.target_language}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{t("translatorJobs.active.customer")}</span>
                                </div>
                                <div className="text-sm">{translation.customer_name || "Unknown Customer"}</div>
                              </div>

                              <Separator />

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{t("translatorJobs.available.jobDetails")}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>{t("translatorJobs.completed.status")}</div>
                                  <div>
                                    <Badge variant="success" className="capitalize">
                                      {t("translatorJobs.completed.completed")}
                                    </Badge>
                                  </div>
                                  
                                  {translation.word_count && (
                                    <>
                                      <div>{t("translatorJobs.available.wordCount")}</div>
                                      <div>{translation.word_count}</div>
                                    </>
                                  )}
                                  
                                  {translation.estimated_hours && (
                                    <>
                                      <div>{t("translatorJobs.available.estimatedHours")}</div>
                                      <div>{translation.estimated_hours ? formatEstimatedTimeCompact(translation.estimated_hours) : "N/A"}</div>
                                    </>
                                  )}
                                </div>
                              </div>

                              <Separator />

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Star className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{t("translatorJobs.completed.rating")}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{translation.rating}/100</span>
                                  {renderStarRating(translation.rating)}
                                </div>
                              </div>

                              {translation.cost && (
                                <>
                                  <Separator />
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="font-medium">{t("translatorJobs.available.payment")}</span>
                                    </div>
                                    <div className="text-xl font-bold">${translation.cost.toFixed(2)}</div>
                                  </div>
                                </>
                              )}
                            </CardContent>
                            <CardFooter>
                              <Button
                                className="w-full"
                                onClick={() => router.push(`/dashboard/translator/orders/${translation.order_id}`)}
                              >
                                {t("translatorJobs.completed.viewCompleteDetails")}
                              </Button>
                            </CardFooter>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <div className="flex justify-center gap-2 mt-4">
                      <CarouselPrevious className="static translate-y-0 translate-x-0" />
                      <CarouselNext className="static translate-y-0 translate-x-0" />
                    </div>
                  </Carousel>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
