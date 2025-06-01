"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import { formatEstimatedTime } from "@/utils/time-formatting"
import { formatComplexity } from "@/utils/complexity-formatting"
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
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { X, Upload, Loader2, CalendarIcon, ChevronLeft, ChevronRight, Star } from "lucide-react"
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

interface Translator {
  id: string;
  full_name: string;
  languages: string[];
  expertise: string[];
  rating: number; // on a 100-point scale
  availability: boolean;
  recommendation_score?: number;
  content_score?: number;
  collaborative_score?: number;
  isRecommended?: boolean;
  hasLanguageMatch?: boolean;
}

interface RecommendedTranslator {
  id: string;
  recommendation_score?: number;
  content_score?: number;
  collaborative_score?: number;
  [key: string]: any; // For any other properties
}

export default function CreateOrder() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLanguage()
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
  const [recommendedTranslators, setRecommendedTranslators] = useState<RecommendedTranslator[]>([])
  const [availableTranslators, setAvailableTranslators] = useState<Translator[]>([])
  const [selectedTranslatorId, setSelectedTranslatorId] = useState<string | null>(null)
  const [loadingTranslators, setLoadingTranslators] = useState(false)
  const [automaticAssignment, setAutomaticAssignment] = useState(true)
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false)
  const [expandedTranslators, setExpandedTranslators] = useState<{[key: string]: boolean}>({})

  // Fetch available translators when component mounts
  useEffect(() => {
    const fetchAvailableTranslators = async () => {
      setLoadingTranslators(true);
      try {
        // Fetch ALL available translators regardless of language
        const { data, error } = await supabase
          .from("translator_profiles")
          .select("*")
          .eq("availability", true);

        if (error) {
          console.error("Error fetching translators:", error);
          throw error;
        }

        // Store all available translators
        setAvailableTranslators(data as unknown as Translator[]);
      } catch (error) {
        console.error("Failed to fetch translators:", error);
      } finally {
        setLoadingTranslators(false);
      }
    };

    fetchAvailableTranslators();
  }, [supabase]); // Only depends on supabase client, not languages

  // Automatically select highest recommended translator when needed
  useEffect(() => {
    if (automaticAssignment && recommendedTranslators.length > 0) {
      // Sort recommended translators by score (highest first)
      const sortedRecommendations = [...recommendedTranslators].sort(
        (a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0)
      );
      
      // Set the highest recommended translator
      const highestRecommended = sortedRecommendations[0];
      if (highestRecommended && highestRecommended.id) {
        setSelectedTranslatorId(highestRecommended.id);
      }
    }
  }, [automaticAssignment, recommendedTranslators]);

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
      setError(t("orders.uploadFileFirst"))
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      // Check file type before uploading
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      if (!fileExt || !['pdf', 'docx', 'txt'].includes(fileExt)) {
        throw new Error(`${t("orders.unsupportedFileType")} ${fileExt || 'unknown'}. ${t("orders.onlyPdfDocxTxt")}`);
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
      console.group('🔍 DOCUMENT ANALYSIS API CALL');
      console.log('📊 Request Parameters:', {
        endpoint: '/api/analyze-document-alt',
        documentUrl,
        sourceLanguage,
        targetLanguage,
        customer_id: user?.id,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch("/api/analyze-document-alt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentUrl,
          sourceLanguage,
          targetLanguage,
          customer_id: user?.id
        }),
      })

      // Try to parse the error message from the response
      if (!response.ok) {
        console.log("Response not ok:", response)
        console.error('❌ API Response Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        console.groupEnd();
        const errorData = await response.json().catch((rr) => ({ error: "Failed to analyze document" }))
        throw new Error(errorData.error || "Failed to analyze document")
      }

      const analysisResult = await response.json()
      console.log('✅ API Response Successful');
      console.log('📈 Analysis Summary:', {
        wordCount: analysisResult.wordCount || 0,
        complexityScore: analysisResult.complexityScore || 0,
        estimatedHours: analysisResult.estimatedHours || 0,
        cost: analysisResult.cost || 0,
        classificationTags: analysisResult.classification?.length || 0,
        recommendedTranslators: analysisResult.recommendedTranslators?.length || 0
      });
      console.groupEnd();
      console.log("Analysis result received:", analysisResult)

      setOrderClassification(analysisResult.classification || [])
      setWordCount(analysisResult.wordCount || 0)
      setComplexityScore(analysisResult.complexityScore || 0)
      setEstimatedHours(analysisResult.estimatedHours || 0)
      setOrderCost(analysisResult.cost || 0)
      
      // Store recommended translators separately without affecting the available translators list
      if (analysisResult.recommendedTranslators && analysisResult.recommendedTranslators.length > 0) {
        // 🎯 CLIENT-SIDE RECOMMENDATION LOGGING 
        console.group('🌐 ORDER CREATION - HYBRID RECOMMENDATION RESULTS');
        console.log('📊 API Response Data:', {
          totalRecommendations: analysisResult.recommendedTranslators.length,
          orderInfo: {
            sourceLanguage,
            targetLanguage,
            customerId: user?.id
          }
        });
        
        console.log('📈 TOP RECOMMENDATIONS:');
        console.table(analysisResult.recommendedTranslators.slice(0, 10).map((translator: any, index: number) => ({
          'Rank': index + 1,
          'Name': translator.full_name,
          'Hybrid Score': translator.recommendation_score?.toFixed(4) || '0.0000',
          'Content Score': translator.content_score?.toFixed(4) || '0.0000',
          'Collaborative Score': translator.collaborative_score?.toFixed(4) || '0.0000',
          'Rating': translator.rating,
          'Languages': translator.languages?.join(', ') || 'N/A'
        })));
        
        console.log('🎯 DETAILED BREAKDOWN:');
        analysisResult.recommendedTranslators.slice(0, 5).forEach((translator: any, index: number) => {
          console.group(`#${index + 1} ${translator.full_name}`);
          console.log('📊 Scores:', {
            hybridScore: translator.recommendation_score?.toFixed(4) || '0.0000',
            contentScore: translator.content_score?.toFixed(4) || '0.0000',
            collaborativeScore: translator.collaborative_score?.toFixed(4) || '0.0000'
          });
          console.log('👤 Profile:', {
            rating: translator.rating,
            languages: translator.languages,
            expertise: translator.expertise,
            totalOrders: translator.total_orders || 'N/A',
            completedOrders: translator.completed_orders || 'N/A'
          });
          console.groupEnd();
        });
        
        // Calculate recommendation quality metrics
        const avgHybridScore = analysisResult.recommendedTranslators.reduce((sum: number, t: any) => sum + (t.recommendation_score || 0), 0) / analysisResult.recommendedTranslators.length;
        const topScore = analysisResult.recommendedTranslators[0]?.recommendation_score || 0;
        const hasCollaborativeData = analysisResult.recommendedTranslators.some((t: any) => (t.collaborative_score || 0) > 0);
        
        console.log('📊 QUALITY METRICS:', {
          averageHybridScore: avgHybridScore.toFixed(4),
          topScore: topScore.toFixed(4),
          hasCollaborativeData,
          recommendationStrength: topScore > 0.5 ? 'Strong' : topScore > 0.3 ? 'Moderate' : 'Weak',
          filteringType: hasCollaborativeData ? 'Hybrid (Content + Collaborative)' : 'Content-Based Only'
        });
        
        console.log('💡 RECOMMENDATION SYSTEM INSIGHTS:');
        console.log('   ✅ This shows the client-side view of hybrid filtering results');
        console.log('   🔍 Server-side detailed logs are available in Vercel function logs');
        console.log('   📊 These scores combine content-based (60%) + collaborative (40%) filtering');
        console.log('   🎯 Higher scores indicate better translator-order matches');
        console.groupEnd();
        
        // Log detailed info about the recommended translators
        console.log(`Received ${analysisResult.recommendedTranslators.length} recommended translators`);
        
        // Check which recommended translators are not in the available list
        const availableIds = new Set(availableTranslators.map(t => t.id));
        const missingTranslators = analysisResult.recommendedTranslators.filter(
          (t: RecommendedTranslator) => !availableIds.has(t.id)
        );
        
        if (missingTranslators.length > 0) {
          console.log(`Warning: ${missingTranslators.length} recommended translators are not in the available list`);
          console.log("Missing translator IDs:", missingTranslators.map((t: RecommendedTranslator) => t.id));
        }
        
        // Only use recommended translators that are in the available list
        const filteredRecommendations = analysisResult.recommendedTranslators.filter(
          (t: RecommendedTranslator) => availableIds.has(t.id)
        );
        
        console.log(`Using ${filteredRecommendations.length} recommended translators that are in the available list`);
        setRecommendedTranslators(filteredRecommendations);
      } else {
        console.group('🌐 ORDER CREATION - NO RECOMMENDATIONS');
        console.log('⚠️ No recommendations returned from hybrid filtering');
        console.log('💡 This could mean:');
        console.log('   - No translators match the language pair');
        console.log('   - All translators have 0 scores');
        console.log('   - Error in recommendation system');
        console.log('   - First time customer (no collaborative data)');
        console.groupEnd();
        
        setRecommendedTranslators([]);
        console.log("No recommended translators received from analysis");
      }

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
      setError(t("orders.mustBeLoggedIn"))
      return
    }

    if (!file || !sourceLanguage || !targetLanguage || !deadline) {
      setError(t("orders.fillAllFields"))
      return
    }

    if (comment.length > 200) {
      setError(t("orders.commentTooLong"))
      return
    }

    // Make sure we have analysis data before proceeding
    if (orderCost === null) {
      setError(t("orders.analyzeDocumentFirst"))
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
      const { error: insertError, data: orderData } = await supabase.from("orders").insert({
        customer_id: user.id,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        deadline: deadlineStr,
        tags: [...tags, ...orderClassification],
        comment,
        document_url: publicUrl,
        status: "pending",
        cost: orderCost || 0,
      }).select('id').single()

      if (insertError) {
        throw insertError
      }

      // Now that we have the order ID, save the analysis to the order_analysis table
      if (orderData?.id) {
        try {
          console.log("Saving analysis for order:", orderData.id);
          
          // Call the analyze-document-alt API again with the order_id
          await fetch("/api/analyze-document-alt", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentUrl: publicUrl,
              sourceLanguage,
              targetLanguage,
              order_id: orderData.id,
              customer_id: user.id
            }),
          });
          
          console.log("Analysis saved for order:", orderData.id);
          
          // If a specific translator is selected (either manually or automatically), create an assignment request
          if (selectedTranslatorId) {
            const { error: assignmentError } = await supabase.from("order_assignments").insert({
              order_id: orderData.id,
              translator_id: selectedTranslatorId,
              customer_id: user.id,
              assigned_at: new Date().toISOString(),
              status: "requested" // Always create a request regardless of assignment method
            });
            
            if (assignmentError) {
              console.error("Error creating translator assignment:", assignmentError);
            } else {
              console.log("Translator assignment request created for:", selectedTranslatorId, automaticAssignment ? "(automatic selection)" : "(manual selection)");
              
              // We don't need to update order status since it's always a request
            }
          }
        } catch (analysisError) {
          console.error("Error saving analysis for order:", analysisError);
          // Continue even if analysis saving fails
        }
      }

      router.push("/dashboard/customer/orders")
    } catch (error) {
      console.error("Error creating order:", error)
      setError(t("orders.failedToCreateOrder"))
    } finally {
      setLoading(false)
    }
  }

  // First, create a helper function to check if a translator has the required languages
  const hasRequiredLanguages = (translator: Translator) => {
    if (!sourceLanguage || !targetLanguage) return true; // If no languages selected, don't filter
    return translator.languages.includes(sourceLanguage) && 
           translator.languages.includes(targetLanguage);
  };

  // Get filtered translators based on recommendation filter and language filter
  // First, enhance all available translators with recommendation scores
  const enhancedTranslators = availableTranslators.map(translator => {
    // Find if this translator is in the recommended list
    const recommendedTranslator = recommendedTranslators.find(rt => rt.id === translator.id);
    
    // If it's recommended, add the recommendation scores
    if (recommendedTranslator) {
      return {
        ...translator,
        recommendation_score: recommendedTranslator.recommendation_score || 0,
        content_score: recommendedTranslator.content_score || 0,
        collaborative_score: recommendedTranslator.collaborative_score || 0,
        isRecommended: true,
        hasLanguageMatch: hasRequiredLanguages(translator)
      };
    }
    
    // If not recommended, return with default values
    return {
      ...translator,
      recommendation_score: 0,
      content_score: 0,
      collaborative_score: 0,
      isRecommended: false,
      hasLanguageMatch: hasRequiredLanguages(translator)
    };
  });

  // Then apply filtering based on the showOnlyRecommended flag
  const filteredTranslators = showOnlyRecommended 
    ? enhancedTranslators.filter(t => t.isRecommended)
    : enhancedTranslators;

  // Handle click on translator card
  const handleTranslatorSelect = (translatorId: string) => {
    if (!automaticAssignment) {
      setSelectedTranslatorId(translatorId === selectedTranslatorId ? null : translatorId);
    }
  };

  // Toggle automatic assignment
  const handleAutomaticAssignmentChange = (checked: CheckedState) => {
    setAutomaticAssignment(checked === true);
    
    // If turning off automatic assignment, keep the current selection
    // If turning on automatic assignment, the useEffect will handle selection
    if (checked === false && recommendedTranslators.length === 0) {
      // Only clear selection if there are no recommendations
      setSelectedTranslatorId(null);
    }
  };

  // Toggle recommended translators filter
  const handleShowRecommendedChange = (checked: CheckedState) => {
    setShowOnlyRecommended(checked === true);
    
    // If switching to show only recommended and a non-recommended translator is selected, clear the selection
    if (checked === true && selectedTranslatorId) {
      const isSelected = recommendedTranslators.some(t => t.id === selectedTranslatorId);
      if (!isSelected) {
        setSelectedTranslatorId(null);
      }
    }
  };

  // Toggle translator skills expansion
  const toggleTranslatorExpansion = (translatorId: string, event: React.MouseEvent) => {
    event.preventDefault(); // Prevent default behavior
    event.stopPropagation(); // Prevent card selection and form submission
    
    setExpandedTranslators(prev => ({
      ...prev,
      [translatorId]: !prev[translatorId]
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{t("orders.createNewOrder")}</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("orders.documentInformation")}</CardTitle>
                <CardDescription>{t("orders.uploadDocumentDetails")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="file">{t("orders.uploadDocument")}</Label>
                  <div className="flex items-center gap-2">
                    <Input id="file" type="file" onChange={handleFileChange} className="flex-1" />
                  </div>
                  {file && <p className="text-sm text-muted-foreground">{t("orders.selectedFile")} {file.name}</p>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sourceLanguage">{t("orders.sourceLanguage")}</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger id="sourceLanguage">
                        <SelectValue placeholder={t("orders.selectLanguage")} />
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
                    <Label htmlFor="targetLanguage">{t("orders.targetLanguage")}</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger id="targetLanguage">
                        <SelectValue placeholder={t("orders.selectLanguage")} />
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
                  <Label htmlFor="deadline">{t("orders.deadline")}</Label>
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
                        {deadline ? format(deadline, "PPP") : <span>{t("orders.pickDate")}</span>}
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
                  <Label>{t("orders.commonTags")}</Label>
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
                  <Label htmlFor="tags">{t("orders.customTags")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder={t("orders.addCustomTag")}
                      maxLength={20}
                    />
                    <Button type="button" onClick={addTag} variant="outline" size="sm">
                      {t("orders.add")}
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
                    {t("orders.tagsLimit")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">{t("orders.comment")}</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("orders.commentPlaceholder")}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">{comment.length}/200 {t("orders.charactersCount")}</p>
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
                      {t("orders.analyzingDocument")}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t("orders.analyzeDocument")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("orders.orderSummary")}</CardTitle>
                <CardDescription>{t("orders.reviewOrderDetails")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderCost !== null ? (
                  <>
                    <div className="rounded-lg bg-muted p-4">
                      <h3 className="mb-2 font-semibold">{t("orders.documentAnalysis")}</h3>

                      <div className="mb-4">
                        <p className="text-sm font-medium">{t("orders.classification")}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {orderClassification.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                        <div className="font-medium">{t("orders.wordCount")}</div>
                        <div>{wordCount}</div>

                        <div className="font-medium">{t("orders.complexityScore")}</div>
                        <div>{complexityScore ? formatComplexity(complexityScore) : "N/A"}</div>

                        <div className="font-medium">{t("orders.estimatedHours")}</div>
                        <div>{estimatedHours ? formatEstimatedTime(estimatedHours) : "0 minutes"}</div>
                      </div>

                      <div>
                        <p className="text-sm font-medium">{t("orders.estimatedCost")}</p>
                        <p className="text-2xl font-bold">${orderCost.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold">{t("orders.translatorAssignment")}</h3>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="automaticAssignment" 
                          checked={automaticAssignment}
                          onCheckedChange={handleAutomaticAssignmentChange}
                        />
                        <label
                          htmlFor="automaticAssignment"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {t("orders.automaticAssignment")}
                        </label>
                      </div>
                      
                      {automaticAssignment && selectedTranslatorId && recommendedTranslators.length > 0 && (
                        <div className="rounded-lg bg-primary/5 p-3 border-l-4 border-primary mt-4">
                          <div className="text-sm flex items-center">
                            <span className="font-medium mr-2">{t("orders.systemSelected")}</span>
                            {availableTranslators.find(t => t.id === selectedTranslatorId)?.full_name || ''}
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
                                {Math.round((recommendedTranslators.find(t => t.id === selectedTranslatorId)?.recommendation_score || 0) * 100)}% {t("orders.match")}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {!automaticAssignment && (
                        <>
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">{t("orders.availableTranslators")}</h4>

                    {recommendedTranslators.length > 0 && (
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="showRecommended" 
                                  checked={showOnlyRecommended}
                                  onCheckedChange={handleShowRecommendedChange}
                                />
                                <label
                                  htmlFor="showRecommended"
                                  className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {t("orders.showOnlyRecommended")}
                                </label>
                              </div>
                            )}
                          </div>
                          
                          {/* Styled debug info */}
                          <div className="flex flex-wrap gap-2 mb-3 p-2 rounded-md bg-muted/30 border border-border">
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted-foreground mr-1">{t("orders.available")}</span>
                              <span className="text-xs font-semibold">{availableTranslators.length}</span>
                            </div>
                            <div className="h-4 border-r border-border/50"></div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted-foreground mr-1">{t("orders.showing")}</span>
                              <span className="text-xs font-semibold">{filteredTranslators.length}</span>
                            </div>
                            <div className="h-4 border-r border-border/50"></div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted-foreground mr-1">{t("orders.recommended")}</span>
                              <span className="text-xs font-semibold">{recommendedTranslators.length}</span>
                            </div>
                            <div className="h-4 border-r border-border/50"></div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-muted-foreground mr-1">{t("orders.withLanguageMatch")}</span>
                              <span className="text-xs font-semibold">{enhancedTranslators.filter(t => t.hasLanguageMatch).length}</span>
                            </div>
                          </div>
                          
                          {loadingTranslators ? (
                            <div className="text-center py-3">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                              <p className="text-sm text-muted-foreground mt-1">{t("orders.loadingTranslators")}</p>
                            </div>
                          ) : filteredTranslators.length === 0 ? (
                            <div className="text-center py-3 text-muted-foreground text-sm">
                              {showOnlyRecommended 
                                ? t("orders.noRecommendedTranslators")
                                : t("orders.noTranslatorsAvailable")}
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
                                    
                                  // Use the isRecommended property directly now
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
                                                title={t("orders.matchesRequiredLanguages")}
                                                aria-label={t("orders.matchesRequiredLanguages")}
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
                                                title={t("orders.doesNotMatchRequiredLanguages")}
                                                aria-label={t("orders.doesNotMatchRequiredLanguages")}
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
                                                {t("orders.recommended")}
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
                                        <div className="text-xs text-muted-foreground mb-1">{t("orders.languages")}</div>
                                        <div className="flex flex-wrap gap-1">
                                          {showLanguages.map(lang => (
                                            <Badge key={lang} variant="secondary" className="text-xs px-2 py-0 h-5">
                                              {lang}
                                            </Badge>
                                          ))}
                                          {!isExpanded && translator.languages.length > 5 && (
                                            <span className="text-xs text-muted-foreground flex items-center">
                                              +{translator.languages.length - 5} {t("orders.more")}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="mt-3">
                                        <div className="text-xs text-muted-foreground mb-1">{t("orders.expertise")}</div>
                                        <div className="flex flex-wrap gap-1">
                                          {showExpertise.map(exp => (
                                            <Badge key={exp} variant="outline" className="text-xs px-2 py-0 h-5">
                                              {exp}
                                            </Badge>
                                          ))}
                                          {!isExpanded && translator.expertise.length > 5 && (
                                            <span className="text-xs text-muted-foreground flex items-center">
                                              +{translator.expertise.length - 5} {t("orders.more")}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {(hasMoreSkills || isRecommended) && (
                                        <div className="mt-2">
                                          <button 
                                            onClick={(e) => toggleTranslatorExpansion(translator.id, e)} 
                                            className="text-xs text-primary hover:underline focus:outline-none"
                                            type="button" // Explicitly prevent form submission
                                          >
                                            {isExpanded ? t("orders.showLess") : t("orders.showMore")}
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
                                <span className="font-medium mr-2">{t("orders.selectedTranslator")}</span>
                                {availableTranslators.find(t => t.id === selectedTranslatorId)?.full_name || ''}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold">{t("orders.orderDetails")}</h3>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="font-medium">{t("orders.document")}</div>
                        <div>{file?.name}</div>

                        <div className="font-medium">{t("orders.sourceLanguage")}</div>
                        <div>{sourceLanguage}</div>

                        <div className="font-medium">{t("orders.targetLanguage")}</div>
                        <div>{targetLanguage}</div>

                        <div className="font-medium">{t("orders.deadline")}</div>
                        <div>{deadline ? format(deadline, "PPP") : t("orders.notSet")}</div>

                        {comment && (
                          <>
                            <div className="font-medium">{t("orders.comment")}</div>
                            <div>{comment}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <h3 className="mb-2 text-lg font-semibold">{t("orders.noAnalysisYet")}</h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      {t("orders.noAnalysisDescription")}
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
                      {t("orders.creatingOrder")}
                    </>
                  ) : (
                    t("orders.createOrder")
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

