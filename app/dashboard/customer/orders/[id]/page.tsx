"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Download, Clock, User, AlertCircle, Loader2, Star, X, AlertTriangle, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getHybridRecommendations } from "@/utils/recommendation-system"
import { CheckedState } from "@radix-ui/react-checkbox"

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

// Enhance Translator interface to match create page
interface EnhancedTranslator extends Translator {
  recommendation_score?: number;
  content_score?: number;
  collaborative_score?: number;
  isRecommended?: boolean;
  hasLanguageMatch?: boolean;
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
  const [success, setSuccess] = useState<string | null>(null)
  
  // New state variables for reassignment
  const [availableTranslators, setAvailableTranslators] = useState<EnhancedTranslator[]>([])
  const [recommendedTranslators, setRecommendedTranslators] = useState<EnhancedTranslator[]>([])
  const [selectedTranslatorId, setSelectedTranslatorId] = useState<string | null>(null)
  const [automaticAssignment, setAutomaticAssignment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fetchingTranslators, setFetchingTranslators] = useState(false)
  const [expandedTranslators, setExpandedTranslators] = useState<Record<string, boolean>>({})

  // Function to fetch order details
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

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [supabase, orderId])

  // New function to fetch available translators
  const fetchAvailableTranslators = async () => {
    if (!order) return;
    
    try {
      setFetchingTranslators(true);
      
      // Fetch all translators who know both languages
      const { data: translators, error: translatorsError } = await supabase
        .from("translator_profiles")
        .select("*")
        .contains("languages", [order.source_language, order.target_language]);
      
      if (translatorsError) throw translatorsError;
      
      // Cast to unknown first, then to Translator[]
      const translatorsList = (translators as unknown as EnhancedTranslator[]) || [];
      
      // Get recommended translators
      if (translators && translators.length > 0) {
        try {
          const response = await fetch("/api/recommendations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: order.id,
              customerId: order.customer_id
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const recommendedList = data.recommendedTranslators || [];
            setRecommendedTranslators(recommendedList);
            
            // Mark translators as recommended and add their scores
            const enhancedTranslators = translatorsList.map(translator => {
              // Find if this translator is in the recommended list
              const recommendedTranslator = recommendedList.find((rt: any) => rt.id === translator.id);
              
              // Check if the translator has the required languages
              const hasLanguageMatch = translator.languages.includes(order.source_language) && 
                                      translator.languages.includes(order.target_language);
              
              // If it's recommended, add the recommendation scores
              if (recommendedTranslator) {
                return {
                  ...translator,
                  recommendation_score: recommendedTranslator.recommendation_score || 0,
                  content_score: recommendedTranslator.content_score || 0,
                  collaborative_score: recommendedTranslator.collaborative_score || 0,
                  isRecommended: true,
                  hasLanguageMatch
                };
              }
              
              // If not recommended, return with default values
              return {
                ...translator,
                recommendation_score: 0,
                content_score: 0,
                collaborative_score: 0,
                isRecommended: false,
                hasLanguageMatch
              };
            });
            
            setAvailableTranslators(enhancedTranslators);
            
            // If automatic assignment is on, select the top recommendation
            if (automaticAssignment && recommendedList.length > 0) {
              setSelectedTranslatorId(recommendedList[0].id);
            }
          }
        } catch (error) {
          console.error("Error fetching recommendations:", error);
          
          // If recommendations fail, still set the basic translators
          const basicTranslators = translatorsList.map(translator => ({
            ...translator,
            recommendation_score: 0,
            content_score: 0,
            collaborative_score: 0,
            isRecommended: false,
            hasLanguageMatch: translator.languages.includes(order.source_language) && 
                             translator.languages.includes(order.target_language)
          }));
          
          setAvailableTranslators(basicTranslators);
        }
      }
    } catch (error) {
      console.error("Error fetching translators:", error);
    } finally {
      setFetchingTranslators(false);
    }
  };

  // Add new useEffect to fetch translators when order changes and no assignment exists
  useEffect(() => {
    if (order && !assignment) {
      fetchAvailableTranslators();
    }
  }, [order, assignment]);

  // Function to assign translator
  const assignTranslator = async () => {
    if (!order || !selectedTranslatorId) return;
    
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      // Create assignment request
      const { error: assignmentError } = await supabase
        .from("order_assignments")
        .insert({
          order_id: order.id,
          translator_id: selectedTranslatorId,
          customer_id: order.customer_id,
          assigned_at: new Date().toISOString(),
          status: "requested" // Always create a request
        });
      
      if (assignmentError) throw assignmentError;
      
      // Refresh order details to show the new assignment
      await fetchOrderDetails();
      
      setSuccess("Translator assignment request created successfully");
    } catch (error: any) {
      console.error("Error assigning translator:", error);
      setError(error.message || "Failed to assign translator");
    } finally {
      setSubmitting(false);
    }
  };

  // Function to toggle automatic assignment
  const handleAutomaticAssignmentChange = (checked: CheckedState) => {
    const newValue = checked === true;
    setAutomaticAssignment(newValue);
    
    // If automatic assignment is turned on and we have recommendations, select the top one
    if (newValue && recommendedTranslators.length > 0) {
      setSelectedTranslatorId(recommendedTranslators[0].id);
    }
  };
  
  // Function to handle translator selection
  const handleTranslatorSelect = (translatorId: string) => {
    if (!automaticAssignment) {
      setSelectedTranslatorId(translatorId === selectedTranslatorId ? null : translatorId);
    }
  };
  
  // Function to toggle translator details expansion
  const toggleTranslatorExpansion = (translatorId: string, event: React.MouseEvent) => {
    event.preventDefault(); // Prevent default behavior
    event.stopPropagation(); // Prevent card selection
    
    setExpandedTranslators(prev => ({
      ...prev,
      [translatorId]: !prev[translatorId]
    }));
  };
  
  // Use all available translators (no filtering)
  const filteredTranslators = availableTranslators;

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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm truncate max-w-[60%]" title={order.document_url.split("/").pop()?.split("?")[0] || "Document"}>
                    {order.document_url.split("/").pop()?.split("?")[0] || "Document"}
                  </div>
                  <Button variant="outline" size="sm" asChild className="flex-shrink-0">
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm truncate max-w-[60%]" title={order.translated_document_url.split("/").pop()?.split("?")[0] || "Translated Document"}>
                        {order.translated_document_url.split("/").pop()?.split("?")[0] || "Translated Document"}
                      </div>
                      <Button variant="outline" size="sm" asChild className="flex-shrink-0">
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
                  {assignment 
                    ? "Assigned translator information" 
                    : "No translator assigned yet"}
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
                  <>
                    {order?.status === "pending" ? (
                      <div className="space-y-4">
                        {error && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                        
                        {success && (
                          <Alert className="bg-green-50 text-green-800 border-green-200">
                            <AlertDescription>{success}</AlertDescription>
                          </Alert>
                        )}
                        
                        <div className="flex flex-col space-y-4">
                          {/* Enhanced notification message */}
                          <Alert className="bg-red-50 border-red-200 py-2 px-3">
                            <XCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0" />
                            <div className="text-sm">
                              <h4 className="text-red-800 font-medium text-sm">Translator Declined Request</h4>
                              <p className="text-red-700 text-xs">The previously assigned translator has declined your translation request. Please select a new translator below.</p>
                            </div>
                          </Alert>
                          
                          <div className="flex items-center space-x-2 mt-4">
                            <Checkbox 
                              id="automaticAssignment" 
                              checked={automaticAssignment}
                              onCheckedChange={handleAutomaticAssignmentChange}
                            />
                            <label
                              htmlFor="automaticAssignment"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Automatic Assignment (system will select the best translator)
                            </label>
                          </div>
                          
                          {automaticAssignment && selectedTranslatorId && recommendedTranslators.length > 0 && (
                            <div className="rounded-lg bg-primary/5 p-3 border-l-4 border-primary mt-4">
                              <div className="text-sm flex items-center">
                                <span className="font-medium mr-2">System selected:</span>
                                <span>{availableTranslators.find(t => t.id === selectedTranslatorId)?.full_name || ''}</span>
                                {recommendedTranslators.find(t => t.id === selectedTranslatorId)?.recommendation_score && (
                                  <span className="ml-auto text-xs text-primary font-medium flex items-center gap-1">
                                    <div className="relative h-4 w-4 flex-shrink-0">
                                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                                        <circle 
                                          cx="12" 
                                          cy="12" 
                                          r="9" 
                                          fill="none" 
                                          stroke="#e2e8f0" 
                                          strokeWidth="2.5"
                                        />
                                        <circle 
                                          cx="12" 
                                          cy="12" 
                                          r="9" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeDasharray={`${Math.min(100, Math.round((recommendedTranslators.find(t => t.id === selectedTranslatorId)?.recommendation_score || 0) * 100)) * 0.565} 100`}
                                          strokeDashoffset="0"
                                          transform="rotate(-90 12 12)"
                                        />
                                      </svg>
                                    </div>
                                    {Math.round((recommendedTranslators.find(t => t.id === selectedTranslatorId)?.recommendation_score || 0) * 100)}% match
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {!automaticAssignment && (
                            <>
                              <div className="flex justify-between items-center mt-4">
                                <h4 className="text-sm font-medium">Available Translators</h4>
                              </div>
                              
                              {/* Styled debug info */}
                              <div className="flex flex-wrap gap-2 mb-3 p-2 rounded-md bg-muted/30 border border-border">
                                <div className="flex items-center">
                                  <span className="text-xs font-medium text-muted-foreground mr-1">Available:</span>
                                  <span className="text-xs font-semibold">{availableTranslators.length}</span>
                                </div>
                                <div className="h-4 border-r border-border/50"></div>
                                <div className="flex items-center">
                                  <span className="text-xs font-medium text-muted-foreground mr-1">Recommended:</span>
                                  <span className="text-xs font-semibold">{recommendedTranslators.length}</span>
                                </div>
                                <div className="h-4 border-r border-border/50"></div>
                                <div className="flex items-center">
                                  <span className="text-xs font-medium text-muted-foreground mr-1">With language match:</span>
                                  <span className="text-xs font-semibold">{availableTranslators.filter(t => t.hasLanguageMatch).length}</span>
                                </div>
                              </div>
                              
                              {fetchingTranslators ? (
                                <div className="text-center py-3">
                                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                  <p className="text-sm text-muted-foreground mt-1">Loading translators...</p>
                                </div>
                              ) : filteredTranslators.length === 0 ? (
                                <div className="text-center py-3 text-muted-foreground text-sm">
                                  No translators available
                                </div>
                              ) : (
                                <ScrollArea className="h-[320px] rounded-md border bg-muted/10 p-2">
                                  <div className="grid grid-cols-1 gap-3 pr-3">
                                    {filteredTranslators.map((translator) => {
                                      // Get expansion state for this translator
                                      const isExpanded = expandedTranslators[translator.id] || false;
                                      
                                      // Determine which skills to show
                                      const showLanguages = isExpanded 
                                        ? translator.languages 
                                        : translator.languages.slice(0, 5);
                                        
                                      const showExpertise = isExpanded 
                                        ? translator.expertise 
                                        : translator.expertise.slice(0, 5);
                                        
                                      const hasMoreSkills = 
                                        translator.languages.length > 5 || 
                                        translator.expertise.length > 5;
                                      
                                      // Use the isRecommended property
                                      const isRecommended = translator.isRecommended;
                                      const hasLanguageMatch = translator.hasLanguageMatch;
                                      
                                      // Get recommendation score if available
                                      const recommendationScore = translator.recommendation_score || 0;
                                        
                                      return (
                                        <div 
                                          key={translator.id} 
                                          className={`rounded-lg bg-card border p-4 cursor-pointer transition-all hover:shadow-md ${
                                            selectedTranslatorId === translator.id 
                                              ? "border-primary border-2 shadow-sm" 
                                              : !hasLanguageMatch
                                                ? "opacity-70 hover:border-red-200"
                                                : "hover:border-muted-foreground"
                                          }`}
                                          onClick={() => handleTranslatorSelect(translator.id)}
                                        >
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                              <div className="font-semibold">{translator.full_name}</div>
                                              <div className="flex items-center gap-1">
                                                {hasLanguageMatch ? (
                                                  <span 
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50 text-green-600 border border-green-200" 
                                                    title="Matches required languages"
                                                    aria-label="This translator matches the required languages"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                                      <circle cx="12" cy="12" r="10"></circle>
                                                      <line x1="2" y1="12" x2="22" y2="12"></line>
                                                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                                    </svg>
                                                  </span>
                                                ) : (
                                                  <span 
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50 text-red-600 border border-red-200" 
                                                    title="Does not match required languages"
                                                    aria-label="This translator does not match the required languages"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                                      <circle cx="12" cy="12" r="10"></circle>
                                                      <line x1="2" y1="12" x2="22" y2="12"></line>
                                                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                                    </svg>
                                                  </span>
                                                )}
                                                {isRecommended && (
                                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 px-1.5 py-0 h-5">
                                                    Recommended
                                                  </Badge>
                                                )}
                                                {isRecommended && recommendationScore > 0 && (
                                                  <Badge variant="outline" className="flex items-center gap-1 text-xs px-1.5 py-0.5 h-5 bg-blue-50 text-blue-700 border-blue-200">
                                                    {/* Circular progress indicator */}
                                                    <div className="relative h-4 w-4 flex-shrink-0">
                                                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                                                        <circle 
                                                          cx="12" 
                                                          cy="12" 
                                                          r="9" 
                                                          fill="none" 
                                                          stroke="#ccd6e7" 
                                                          strokeWidth="4.5"
                                                        />
                                                        <circle 
                                                          cx="12" 
                                                          cy="12" 
                                                          r="9" 
                                                          fill="none" 
                                                          stroke="#3b82f6" 
                                                          strokeWidth="4.5"
                                                          strokeLinecap="round"
                                                          strokeDasharray={`${Math.min(100, Math.round(recommendationScore * 100)) * 0.565} 100`}
                                                          strokeDashoffset="0"
                                                          transform="rotate(-90 12 12)"
                                                        />
                                                      </svg>
                                                    </div>
                                                    <span className="font-medium whitespace-nowrap">
                                                      {Math.round(recommendationScore * 100)}%
                                                    </span>
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                              <span className="text-sm font-medium">{translator.rating}/100</span>
                                            </div>
                                          </div>
                                          
                                          <div className="mt-2">
                                            <div className="text-xs text-muted-foreground mb-1">Languages:</div>
                                            <div className="flex flex-wrap gap-1">
                                              {showLanguages.map(lang => (
                                                <Badge key={lang} variant="secondary" className="text-xs px-2 py-0 h-5">
                                                  {lang}
                                                </Badge>
                                              ))}
                                              {!isExpanded && translator.languages.length > 5 && (
                                                <span className="text-xs text-muted-foreground flex items-center">
                                                  +{translator.languages.length - 5} more
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="mt-3">
                                            <div className="text-xs text-muted-foreground mb-1">Expertise:</div>
                                            <div className="flex flex-wrap gap-1">
                                              {showExpertise.map(exp => (
                                                <Badge key={exp} variant="outline" className="text-xs px-2 py-0 h-5">
                                                  {exp}
                                                </Badge>
                                              ))}
                                              {!isExpanded && translator.expertise.length > 5 && (
                                                <span className="text-xs text-muted-foreground flex items-center">
                                                  +{translator.expertise.length - 5} more
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {(hasMoreSkills || isRecommended) && (
                                            <div className="mt-2">
                                              <button 
                                                onClick={(e) => toggleTranslatorExpansion(translator.id, e)} 
                                                className="text-xs text-primary hover:underline focus:outline-none"
                                                type="button"
                                              >
                                                {isExpanded ? 'Show less' : 'Show more'}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              )}
                              
                              {selectedTranslatorId && !automaticAssignment && (
                                <div className="rounded-lg bg-primary/5 p-3 border-l-4 border-primary mt-4">
                                  <div className="text-sm flex items-center">
                                    <span className="font-medium mr-2">Selected Translator:</span>
                                    {availableTranslators.find(t => t.id === selectedTranslatorId)?.full_name || ''}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          
                          <Button 
                            onClick={assignTranslator} 
                            disabled={
                              submitting || 
                              !selectedTranslatorId || 
                              (automaticAssignment && recommendedTranslators.length === 0)
                            }
                            className="w-full mt-4"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Assigning...
                              </>
                            ) : (
                              "Assign Translator"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        Your order is pending assignment to a translator
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
