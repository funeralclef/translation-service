"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

export default function SelectRole() {
  const router = useRouter()
  const [role, setRole] = useState<string>("customer")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClientComponentClient()

  const handleRoleSelection = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("User not found. Please log in again.")
        return
      }

      // Update user metadata with selected role
      const { error } = await supabase.auth.updateUser({
        data: { role },
      })

      if (error) {
        setError(error.message)
        return
      }

      // Redirect to dashboard based on role
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      setError("An unexpected error occurred")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Select your role</CardTitle>
          <CardDescription>Choose how you want to use our platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRoleSelection} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <RadioGroup value={role} onValueChange={setRole} className="space-y-4">
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="customer" id="customer" />
                <div className="space-y-1">
                  <Label htmlFor="customer" className="font-medium">
                    Customer
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Upload documents for translation and manage your orders
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="translator" id="translator" />
                <div className="space-y-1">
                  <Label htmlFor="translator" className="font-medium">
                    Translator
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Find translation jobs that match your skills and expertise
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="admin" id="admin" />
                <div className="space-y-1">
                  <Label htmlFor="admin" className="font-medium">
                    Administrator
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Manage users, monitor orders, and oversee platform operations
                  </p>
                </div>
              </div>
            </RadioGroup>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Confirming..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
