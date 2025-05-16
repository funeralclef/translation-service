"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { X, Upload, Loader2, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Ukrainian",
]

const COMMON_TAGS = [
  "Technical",
  "Legal",
  "Medical",
  "Financial",
  "Marketing",
  "Literary",
  "Academic",
  "Scientific",
  "Software",
  "Engineering",
  "Business",
]

export default function CreateOrder() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientComponentClient()

  const [sourceLanguage, setSourceLanguage] = useState("")
  const [targetLanguage, setTargetLanguage] = useState("")
  const [deadline, setDeadline] = useState<Date | undefined>(undefined)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [comment, setComment] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [orderCost, setOrderCost] = useState<number | null>(null)
  const [orderClassification, setOrderClassification] = useState<string[]>([])
  const [wordCount, setWordCount] = useState<number | null>(null)
  const [complexityScore, setComplexityScore] = useState<number | null>(null)
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null)
  const [recommendedTranslators, setRecommendedTranslators] = useState<any[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim()) && tags.length < 5) {
      setTags([...tags, tagInput.trim()])
      setTagInput("")
    }
  }

  const toggleCommonTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag))
    } else if (tags.length < 5) {
      setTags([...tags, tag])
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
  }

  const analyzeDocument = async () => {
    if (!file || !sourceLanguage || !targetLanguage) {
      setError("Please upload a file and select languages first")
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      // Check file type before uploading
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      if (!fileExt || !['pdf', 'docx', 'txt'].includes(fileExt)) {
        throw new Error(`Unsupported file type: ${fileExt || 'unknown'}. Only PDF, DOCX, and TXT files are supported.`);
      }
      
      // Create a unique but readable file name
      const timestamp = Date.now();
      const fileName = `temp/doc_${timestamp}.${fileExt}`;

      console.log("Uploading file for analysis:", fileName)
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        console.error("Error uploading file:", uploadError)
        throw new Error(`Failed to upload file: ${uploadError.message}`)
      }

      // Get the public URL
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName)
      
      if (!urlData || !urlData.publicUrl) {
        throw new Error("Failed to get document URL. Please check your storage bucket permissions.")
      }
      
      const documentUrl = urlData.publicUrl
      console.log("Got public URL:", documentUrl)
      
      // Add a small delay to ensure the file is available (propagation delay)
      console.log("Waiting for file to be accessible...")
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify the file exists before proceeding
      try {
        const headResponse = await fetch(documentUrl, { method: 'HEAD' });
        if (!headResponse.ok) {
          console.error(`File not accessible: ${headResponse.status} ${headResponse.statusText}`);
          throw new Error(`Document file is not accessible. Status: ${headResponse.status}`);
        }
        console.log("File verified accessible");
      } catch (accessError) {
        console.error("Error verifying file access:", accessError);
        throw new Error("Unable to access the uploaded file. Please check storage permissions.");
      }

      // Call the analyze document API
      console.log("Calling analyze-document-alt API with URL:", documentUrl);
      const response = await fetch("/api/analyze-document-alt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentUrl,
          sourceLanguage,
          targetLanguage,
        }),
      })

      // Try to parse the error message from the response
      if (!response.ok) {
        console.log("Response not ok:", response)
        const errorData = await response.json().catch((rr) => ({ error: "Failed to analyze document" }))
        throw new Error(errorData.error || "Failed to analyze document")
      }

      const analysisResult = await response.json()
      console.log("Analysis result received:", analysisResult)

      setOrderClassification(analysisResult.classification || [])
      setWordCount(analysisResult.wordCount || 0)
      setComplexityScore(analysisResult.complexityScore || 0)
      setEstimatedHours(analysisResult.estimatedHours || 0)
      setOrderCost(analysisResult.cost || 0)
      setRecommendedTranslators(analysisResult.recommendedTranslators || [])

      // Clean up temporary file
      console.log("Cleaning up temporary file")
      await supabase.storage.from("documents").remove([fileName])
    } catch (error) {
      console.error("Error analyzing document:", error)
      setError(error instanceof Error ? error.message : "Failed to analyze document. Please try again.")
      
      // Show more helpful error message to the user
      if (error instanceof Error) {
        if (error.message.includes("storage bucket")) {
          setError("Your document couldn't be accessed. The storage bucket may not be public. Please contact support.")
        } else if (error.message.includes("Unsupported file type")) {
          setError("Only PDF, DOCX, and TXT files are supported for analysis.")
        } else if (error.message.includes("Failed to download")) {
          setError("Unable to download your file for analysis. Please check your storage settings or try a different file.")
        }
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      setError("You must be logged in to create an order")
      return
    }

    if (!file || !sourceLanguage || !targetLanguage || !deadline) {
      setError("Please fill in all required fields")
      return
    }

    if (comment.length > 200) {
      setError("Comment must be less than 200 characters")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      // Keep original filename as part of the stored filename
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const fileName = `${user.id}/${Date.now()}_${safeFileName}`

      const { error: uploadError, data: uploadData } = await supabase.storage.from("documents").upload(fileName, file)

      if (uploadError) {
        throw uploadError
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      // Format deadline as ISO string
      const deadlineStr = deadline ? deadline.toISOString() : new Date().toISOString()

      // Create order in the database
      const { error: insertError } = await supabase.from("orders").insert({
        customer_id: user.id,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        deadline: deadlineStr,
        tags: [...tags, ...orderClassification],
        comment,
        document_url: publicUrl,
        status: "pending",
        cost: orderCost || 0,
      })

      if (insertError) {
        throw insertError
      }

      router.push("/dashboard/customer/orders")
    } catch (error) {
      console.error("Error creating order:", error)
      setError("Failed to create order. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Create New Order</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
                <CardDescription>Upload your document and provide translation details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="file">Upload Document</Label>
                  <div className="flex items-center gap-2">
                    <Input id="file" type="file" onChange={handleFileChange} className="flex-1" />
                  </div>
                  {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sourceLanguage">Source Language</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger id="sourceLanguage">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((language) => (
                          <SelectItem key={language} value={language}>
                            {language}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetLanguage">Target Language</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger id="targetLanguage">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((language) => (
                          <SelectItem key={language} value={language}>
                            {language}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !deadline && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={deadline}
                        onSelect={setDeadline}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Common Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {COMMON_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCommonTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Custom Tags (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Add a custom tag and press Enter"
                      maxLength={20}
                    />
                    <Button type="button" onClick={addTag} variant="outline" size="sm">
                      Add
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    You can add up to 5 tags to help categorize your order
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (optional)</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add any special instructions or context for the translator"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">{comment.length}/200 characters</p>
                </div>

                <Button
                  type="button"
                  onClick={analyzeDocument}
                  disabled={!file || !sourceLanguage || !targetLanguage || analyzing}
                  className="w-full"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Document...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Analyze Document
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <CardDescription>Review your order details before submission</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderCost !== null ? (
                  <>
                    <div className="rounded-lg bg-muted p-4">
                      <h3 className="mb-2 font-semibold">Document Analysis</h3>

                      <div className="mb-4">
                        <p className="text-sm font-medium">Classification:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {orderClassification.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                        <div className="font-medium">Word Count:</div>
                        <div>{wordCount}</div>

                        <div className="font-medium">Complexity Score:</div>
                        <div>{complexityScore}</div>

                        <div className="font-medium">Estimated Hours:</div>
                        <div>{estimatedHours}</div>
                      </div>

                      <div>
                        <p className="text-sm font-medium">Estimated Cost:</p>
                        <p className="text-2xl font-bold">${orderCost.toFixed(2)}</p>
                      </div>
                    </div>

                    {recommendedTranslators.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold">Recommended Translators</h3>
                        <div className="space-y-2">
                          {recommendedTranslators.map((translator) => (
                            <div key={translator.id} className="rounded-lg border p-3">
                              <div className="font-medium">{translator.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                Rating: {translator.rating.toFixed(1)}/100
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {translator.expertise &&
                                  translator.expertise.slice(0, 3).map((exp: string) => (
                                    <Badge key={exp} variant="outline" className="text-xs">
                                      {exp}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="font-semibold">Order Details</h3>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="font-medium">Document:</div>
                        <div>{file?.name}</div>

                        <div className="font-medium">Source Language:</div>
                        <div>{sourceLanguage}</div>

                        <div className="font-medium">Target Language:</div>
                        <div>{targetLanguage}</div>

                        <div className="font-medium">Deadline:</div>
                        <div>{deadline ? format(deadline, "PPP") : "Not set"}</div>

                        {comment && (
                          <>
                            <div className="font-medium">Comment:</div>
                            <div>{comment}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <h3 className="mb-2 text-lg font-semibold">No Analysis Yet</h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Upload a document and click "Analyze Document" to see the estimated cost and classification.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={loading || !file || !sourceLanguage || !targetLanguage || !deadline || orderCost === null}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    "Create Order"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
