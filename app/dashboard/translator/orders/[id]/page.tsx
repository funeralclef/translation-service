"use client"

import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import { formatEstimatedTime } from "@/utils/time-formatting"
import { formatComplexity } from "@/utils/complexity-formatting"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Download, Clock, User, Upload, Loader2, CheckCircle2 } from "lucide-react"

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

interface Customer {
  id: string
  full_name: string
  email: string
}

interface Assignment {
  id: string
  status: string | null
}

export default function TranslatorOrderDetail() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { user } = useAuth()
  const supabase = createClientComponentClient()
  const { t } = useLanguage()

  const [order, setOrder] = useState<Order | null>(null)
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [translatedFile, setTranslatedFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrderDetails = async () => {
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

        // Check if translator is assigned to this order
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("order_assignments")
          .select("*")
          .eq("order_id", orderId)
          .eq("translator_id", user.id)
          .single()

        if (assignmentError) {
          // Translator is not assigned to this order
          router.push("/dashboard/translator/jobs")
          return
        }

        // Save the assignment status
        setAssignment(assignmentData as unknown as Assignment)
        console.log("Assignment data loaded:", assignmentData);

        // Fetch order details
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single()

        if (orderError) throw orderError

        setOrder(orderData as unknown as Order)

        // Fetch customer details
        const { data: customerData, error: customerError } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("id", (orderData as any).customer_id)
          .single()

        if (!customerError) {
          setCustomer(customerData as unknown as Customer)
        }

        // Fetch order analysis
        const { data: analysisData, error: analysisError } = await supabase
          .from("order_analysis")
          .select("*")
          .eq("order_id", orderId)
          .single()

        if (!analysisError) {
          setAnalysis(analysisData as unknown as OrderAnalysis)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTranslatedFile(e.target.files[0])
    }
  }

  const acceptRequest = async () => {
    if (!order || !assignment) {
      console.log("Missing order or assignment:", { order: !!order, assignment: !!assignment });
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      console.log("Accepting request for assignment:", assignment.id);
      
      // Update assignment status
      const { error: updateAssignmentError } = await supabase
        .from("order_assignments")
        .update({ status: null }) // Remove the "requested" status
        .eq("id", assignment.id);

      if (updateAssignmentError) {
        console.error("Assignment update error:", updateAssignmentError);
        throw updateAssignmentError;
      }

      console.log("Assignment updated successfully");

      // Update order status
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({ status: "assigned" })
        .eq("id", order.id);

      if (updateOrderError) {
        console.error("Order update error:", updateOrderError);
        throw updateOrderError;
      }

      console.log("Order updated successfully");

      // Update UI
      setOrder({ ...order, status: "assigned" });
      setAssignment({ ...assignment, status: null });
      setSuccess(t("translatorJobs.orderDetails.successRequestAccepted"));
      console.log("UI updated successfully");
    } catch (error) {
      console.error("Error accepting request:", error);
      setError(t("translatorJobs.orderDetails.errorAcceptRequest"));
    } finally {
      setSubmitting(false);
    }
  };

  const declineRequest = async () => {
    if (!assignment) return;

    try {
      setSubmitting(true);
      
      // Delete the assignment request
      const { error: deleteError } = await supabase
        .from("order_assignments")
        .delete()
        .eq("id", assignment.id);

      if (deleteError) throw deleteError;

      // Redirect back to jobs page
      router.push("/dashboard/translator/jobs?tab=requests");
    } catch (error) {
      console.error("Error declining request:", error);
      setError(t("translatorJobs.orderDetails.errorDeclineRequest"));
    } finally {
      setSubmitting(false);
    }
  };

  const startWorking = async () => {
    if (!order) return

    try {
      setSubmitting(true)

      // Update order status to in_progress
      const { error } = await supabase.from("orders").update({ status: "in_progress" }).eq("id", order.id)

      if (error) throw error

      // Update local state
      setOrder({ ...order, status: "in_progress" })
      setSuccess(t("translatorJobs.orderDetails.successStartedWorking"))
    } catch (error) {
      console.error("Error starting work:", error)
      setError(t("translatorJobs.orderDetails.errorUpdateStatus"))
    } finally {
      setSubmitting(false)
    }
  }

  const submitTranslation = async () => {
    if (!order || !translatedFile || !user) return

    try {
      setSubmitting(true)

      // Upload translated file
      const fileExt = translatedFile.name.split(".").pop()
      const fileName = `translated_${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = `translations/${order.id}/${fileName}`

      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, translatedFile)

      if (uploadError) throw uploadError

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath)
      const translatedUrl = urlData.publicUrl

      // Update order status to completed
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "completed",
          translated_document_url: translatedUrl,
        })
        .eq("id", order.id)

      if (updateError) throw updateError

      // Add translation notes
      if (notes.trim()) {
        const { error: notesError } = await supabase.from("translation_notes").insert({
          order_id: order.id,
          translator_id: user.id,
          notes: notes.trim(),
        })

        if (notesError) throw notesError
      }

      // Update local state
      setOrder({ ...order, status: "completed" })
      setSuccess(t("translatorJobs.orderDetails.successTranslationSubmitted"))
    } catch (error) {
      console.error("Error submitting translation:", error)
      setError(t("translatorJobs.orderDetails.errorSubmitTranslation"))
    } finally {
      setSubmitting(false)
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
          <h3 className="mb-2 text-lg font-semibold">{t("translatorJobs.orderDetails.error")}</h3>
          <p className="mb-6 text-sm text-muted-foreground">{error || t("translatorJobs.orderDetails.orderNotFound")}</p>
          <Button onClick={() => router.push("/dashboard/translator/jobs")}>{t("translatorJobs.orderDetails.backToJobs")}</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("translatorJobs.orderDetails.title")}</h1>
            <p className="text-muted-foreground">{t("translatorJobs.orderDetails.orderId")} {order.id}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard/translator/jobs")}>
            {t("translatorJobs.orderDetails.backToJobs")}
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
                <CardTitle>{t("translatorJobs.orderDetails.orderInformation")}</CardTitle>
                <Badge
                  variant={
                    assignment && assignment.status === "requested" 
                      ? "outline"
                      : order.status === "completed" 
                        ? "success" 
                        : order.status === "in_progress" 
                          ? "default" 
                          : "secondary"
                  }
                >
                  {assignment && assignment.status === "requested"
                    ? t("translatorJobs.orderDetails.statusRequestPending")
                    : order.status === "assigned"
                      ? t("translatorJobs.orderDetails.statusAssigned")
                      : order.status === "in_progress"
                        ? t("translatorJobs.orderDetails.statusInProgress")
                        : t("translatorJobs.orderDetails.statusCompleted")}
                </Badge>
              </div>
              <CardDescription>{t("translatorJobs.orderDetails.orderDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t("translatorJobs.orderDetails.customer")}</span>
                </div>
                {customer ? (
                  <div className="text-sm">
                    <div className="font-medium">{customer.full_name}</div>
                    <div className="text-muted-foreground">{customer.email}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t("translatorJobs.orderDetails.customerNotAvailable")}</div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t("translatorJobs.orderDetails.document")}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-sm truncate max-w-full sm:max-w-[60%]" title={order.document_url.split("/").pop()?.split("?")[0] || "Document"}>
                    {order.document_url.split("/").pop()?.split("?")[0] || "Document"}
                  </div>
                  <Button variant="outline" size="sm" asChild className="flex-shrink-0 w-full sm:w-auto">
                    <a href={order.document_url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      {t("translatorJobs.orderDetails.download")}
                    </a>
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">{t("translatorJobs.orderDetails.sourceLanguage")}</div>
                  <div>{order.source_language}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">{t("translatorJobs.orderDetails.targetLanguage")}</div>
                  <div>{order.target_language}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t("translatorJobs.orderDetails.timeline")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">{t("translatorJobs.orderDetails.created")}</div>
                    <div>{formatDate(order.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t("translatorJobs.orderDetails.deadline")}</div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span>{formatDate(order.deadline)}</span>
                      {new Date(order.deadline) < new Date() ? (
                        <Badge variant="destructive" className="w-fit">
                          {t("translatorJobs.orderDetails.overdue")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit">
                          {Math.ceil(
                            (new Date(order.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                          )}{" "}
                          {t("translatorJobs.orderDetails.daysLeft")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="font-medium">{t("translatorJobs.orderDetails.tags")}</div>
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
                    <div className="font-medium">{t("translatorJobs.orderDetails.customerComment")}</div>
                    <div className="text-sm">{order.comment}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("translatorJobs.orderDetails.analysis")}</CardTitle>
                <CardDescription>{t("translatorJobs.orderDetails.analysisDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">{t("translatorJobs.orderDetails.wordCount")}</div>
                        <div>{analysis.word_count}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t("translatorJobs.orderDetails.complexityScore")}</div>
                        <div>{formatComplexity(analysis.complexity_score)}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">{t("translatorJobs.orderDetails.estimatedHours")}</div>
                        <div>{formatEstimatedTime(analysis.estimated_hours)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t("translatorJobs.orderDetails.payment")}</div>
                        <div className="font-bold">${order.cost.toFixed(2)}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">{t("translatorJobs.orderDetails.classification")}</div>
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
                  <div className="text-center py-4 text-muted-foreground">{t("translatorJobs.orderDetails.noAnalysisData")}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {assignment && assignment.status === "requested"
                    ? t("translatorJobs.orderDetails.translationRequest")
                    : order.status === "completed"
                      ? t("translatorJobs.orderDetails.translationCompleted")
                      : t("translatorJobs.orderDetails.submitTranslation")}
                </CardTitle>
                <CardDescription>
                  {assignment && assignment.status === "requested"
                    ? t("translatorJobs.orderDetails.requestDescription")
                    : order.status === "completed"
                      ? t("translatorJobs.orderDetails.completedDescription")
                      : t("translatorJobs.orderDetails.submitDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignment && assignment.status === "requested" ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <FileText className="h-12 w-12 text-primary/70 mb-4" />
                    <h3 className="text-lg font-semibold">{t("translatorJobs.orderDetails.requestTitle")}</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                      {t("translatorJobs.orderDetails.requestMessage")}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                      <Button 
                        onClick={acceptRequest}
                        disabled={submitting}
                        className="w-full sm:min-w-32 sm:w-auto"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("translatorJobs.orderDetails.processing")}
                          </>
                        ) : (
                          t("translatorJobs.orderDetails.acceptRequest")
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={declineRequest}
                        disabled={submitting}
                        className="w-full sm:min-w-32 sm:w-auto"
                      >
                        {t("translatorJobs.orderDetails.decline")}
                      </Button>
                    </div>
                  </div>
                ) : order.status === "completed" ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold">{t("translatorJobs.orderDetails.completedTitle")}</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      {t("translatorJobs.orderDetails.completedMessage")}
                    </p>
                    {order.translated_document_url && (
                      <Button variant="outline" size="sm" className="mt-4 w-full sm:w-auto" asChild>
                        <a href={order.translated_document_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          {t("translatorJobs.orderDetails.downloadTranslatedDocument")}
                        </a>
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="translatedFile">{t("translatorJobs.orderDetails.uploadTranslatedDocument")}</Label>
                      <Input
                        id="translatedFile"
                        type="file"
                        onChange={handleFileChange}
                        disabled={order.status === "assigned" || submitting}
                      />
                      {translatedFile && (
                        <p className="text-sm text-muted-foreground">{t("translatorJobs.orderDetails.selectedFile")} {translatedFile.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">{t("translatorJobs.orderDetails.translationNotes")}</Label>
                      <Textarea
                        id="notes"
                        placeholder={t("translatorJobs.orderDetails.notesPlaceholder")}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={order.status === "assigned" || submitting}
                        className="min-h-[100px]"
                      />
                    </div>

                    {order.status === "assigned" ? (
                      <Button onClick={startWorking} className="w-full" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("translatorJobs.orderDetails.processing")}
                          </>
                        ) : (
                          t("translatorJobs.orderDetails.startWorkingOrder")
                        )}
                      </Button>
                    ) : (
                      <Button onClick={submitTranslation} className="w-full" disabled={!translatedFile || submitting}>
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("translatorJobs.orderDetails.submitting")}
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            {t("translatorJobs.orderDetails.submitTranslation")}
                          </>
                        )}
                      </Button>
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
