"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { registerUser, getSession } from "@/utils/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function Register() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<"customer" | "translator" | "admin">("customer")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check if already logged in
  useEffect(() => {
    const session = getSession()
    if (session?.user) {
      router.push("/dashboard")
    }
  }, [router])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { user, error } = await registerUser(email, password, fullName, role)

      if (error) {
        setError(error)
        setLoading(false)
        return
      }

      if (user) {
        // Ensure session is saved before redirect
        localStorage.setItem("session", JSON.stringify({ user }))

        // Add a small delay to ensure localStorage is updated
        setTimeout(() => {
          router.push("/dashboard")
        }, 100)
      }
    } catch (error) {
      setError("An unexpected error occurred")
      console.error(error)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Enter your information to create an account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <RadioGroup
                value={role}
                onValueChange={(value) => setRole(value as "customer" | "translator" | "admin")}
                className="space-y-4"
              >
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
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary underline">
              Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
