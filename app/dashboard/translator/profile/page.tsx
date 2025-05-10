"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Star, Loader2, X, Plus } from "lucide-react"

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
]

const EXPERTISE_AREAS = [
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

interface CompletedOrder {
  id: string
  order_id: string
  completed_at: string
  customer_name: string
  source_language: string
  target_language: string
  rating: number
  feedback: string
}

export default function TranslatorProfile() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientComponentClient()

  const [fullName, setFullName] = useState("")
  const [languages, setLanguages] = useState<string[]>([])
  const [expertise, setExpertise] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [availability, setAvailability] = useState(true)
  const [rating, setRating] = useState(0)
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [profileExists, setProfileExists] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
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

        // Fetch translator profile
        const { data, error } = await supabase.from("translator_profiles").select("*").eq("id", user.id).single()

        if (error) {
          if (error.code !== "PGRST116") {
            // PGRST116 is "no rows returned" error, which is expected if profile doesn't exist
            console.error("Error fetching profile:", error)
          }
        } else {
          // Profile exists, populate form
          setFullName(data.full_name)
          setLanguages(data.languages || [])
          setExpertise(data.expertise || [])
          setCustomTags(data.custom_tags || [])
          setHourlyRate(data.hourly_rate?.toString() || "")
          setAvailability(data.availability)
          setRating(data.rating || 0)
          setProfileExists(true)
        }

        // Fetch completed orders with feedback
        const { data: completedOrdersData, error: completedOrdersError } = await supabase
          .from("completed_translations")
          .select(`
            id,
            order_id,
            completed_at,
            customer_name,
            source_language,
            target_language,
            rating,
            feedback
          `)
          .eq("translator_id", user.id)
          .order("completed_at", { ascending: false })

        if (completedOrdersError) {
          console.error("Error fetching completed orders:", completedOrdersError)
        } else {
          setCompletedOrders(completedOrdersData || [])
        }
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [supabase, router, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      if (!user) {
        router.push("/auth/login")
        return
      }

      const hourlyRateNum = Number.parseFloat(hourlyRate)
      if (isNaN(hourlyRateNum) || hourlyRateNum <= 0) {
        setError("Please enter a valid hourly rate")
        setSaving(false)
        return
      }

      if (languages.length === 0) {
        setError("Please select at least one language")
        setSaving(false)
        return
      }

      if (expertise.length === 0) {
        setError("Please select at least one area of expertise")
        setSaving(false)
        return
      }

      const profileData = {
        id: user.id,
        full_name: fullName,
        languages,
        expertise,
        custom_tags: customTags,
        hourly_rate: hourlyRateNum,
        availability,
      }

      let error
      if (profileExists) {
        // Update existing profile
        const { error: updateError } = await supabase.from("translator_profiles").update(profileData).eq("id", user.id)
        error = updateError
      } else {
        // Insert new profile
        const { error: insertError } = await supabase.from("translator_profiles").insert({
          ...profileData,
          rating: 0, // Initialize rating for new profiles
        })
        error = insertError
      }

      if (error) {
        throw error
      }

      setSuccess(true)
      setProfileExists(true)
    } catch (error) {
      console.error("Error saving profile:", error)
      setError("Failed to save profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const toggleLanguage = (language: string) => {
    setLanguages((prev) => (prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]))
  }

  const toggleExpertise = (area: string) => {
    setExpertise((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]))
  }

  const addCustomTag = () => {
    if (customTagInput.trim() && !customTags.includes(customTagInput.trim()) && customTags.length < 10) {
      setCustomTags([...customTags, customTagInput.trim()])
      setCustomTagInput("")
    }
  }

  const removeCustomTag = (tag: string) => {
    setCustomTags(customTags.filter((t) => t !== tag))
  }

  const handleCustomTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addCustomTag()
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Translator Profile</h1>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Information</TabsTrigger>
            <TabsTrigger value="completed">Completed Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Set up your translator profile to start receiving translation jobs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert>
                    <AlertDescription>Profile saved successfully!</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>

                  {profileExists && (
                    <div className="space-y-2">
                      <Label>Current Rating</Label>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold">{rating}/100</div>
                        <div className="ml-2">{renderStarRating(rating)}</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Languages</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {LANGUAGES.map((language) => (
                        <div key={language} className="flex items-center space-x-2">
                          <Checkbox
                            id={`language-${language}`}
                            checked={languages.includes(language)}
                            onCheckedChange={() => toggleLanguage(language)}
                          />
                          <label
                            htmlFor={`language-${language}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {language}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Areas of Expertise</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {EXPERTISE_AREAS.map((area) => (
                        <div key={area} className="flex items-center space-x-2">
                          <Checkbox
                            id={`expertise-${area}`}
                            checked={expertise.includes(area)}
                            onCheckedChange={() => toggleExpertise(area)}
                          />
                          <label
                            htmlFor={`expertise-${area}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {area}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customTags">Custom Tags</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="customTags"
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={handleCustomTagKeyDown}
                        placeholder="Add a custom tag and press Enter"
                        maxLength={20}
                      />
                      <Button type="button" onClick={addCustomTag} variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {customTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {customTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeCustomTag(tag)}
                              className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      You can add up to 10 custom tags to highlight your specific skills
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      min="1"
                      step="0.01"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="availability"
                      checked={availability}
                      onCheckedChange={(checked) => setAvailability(checked as boolean)}
                    />
                    <label
                      htmlFor="availability"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Available for new translation jobs
                    </label>
                  </div>

                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Completed Orders</CardTitle>
                <CardDescription>View your completed translation orders and customer feedback</CardDescription>
              </CardHeader>
              <CardContent>
                {completedOrders.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <h3 className="mb-2 text-lg font-semibold">No completed orders yet</h3>
                    <p className="text-sm text-muted-foreground">Your completed translation orders will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {completedOrders.map((order) => (
                      <div key={order.id} className="rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium">Order #{order.order_id.slice(0, 8)}</h3>
                            <p className="text-sm text-muted-foreground">
                              Completed on {new Date(order.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center">
                            <span className="mr-2 font-medium">{order.rating}/100</span>
                            {renderStarRating(order.rating)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div className="font-medium">Customer:</div>
                          <div>{order.customer_name}</div>
                          <div className="font-medium">Languages:</div>
                          <div>{`${order.source_language} → ${order.target_language}`}</div>
                        </div>
                        {order.feedback && (
                          <>
                            <Separator className="my-2" />
                            <div className="mt-2">
                              <h4 className="text-sm font-medium mb-1">Customer Feedback:</h4>
                              <p className="text-sm italic">"{order.feedback}"</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
