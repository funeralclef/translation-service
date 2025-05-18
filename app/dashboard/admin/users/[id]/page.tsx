"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface User {
  id: string
  email: string
  full_name: string
  role: "customer" | "translator" | "admin"
  created_at: string
}

interface TranslatorProfile {
  id: string
  full_name: string
  languages: string[]
  expertise: string[]
  custom_tags: string[]
  availability: boolean
  rating: number
}

interface Order {
  id: string
  source_language: string
  target_language: string
  deadline: string
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  cost: number
  created_at: string
}

export default function AdminUserDetail() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string
  const { user: currentUser } = useAuth()
  const supabase = createClientComponentClient()

  const [user, setUser] = useState<User | null>(null)
  const [translatorProfile, setTranslatorProfile] = useState<TranslatorProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"customer" | "translator" | "admin">("customer")

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        if (!currentUser || currentUser.role !== "admin") {
          router.push("/dashboard")
          return
        }

        // Fetch user details
        const { data: userData, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

        if (userError) throw userError

        setUser(userData)
        setFullName(userData.full_name || "")
        setEmail(userData.email || "")
        setRole(userData.role)

        // If user is a translator, fetch translator profile
        if (userData.role === "translator") {
          const { data: profileData, error: profileError } = await supabase
            .from("translator_profiles")
            .select("*")
            .eq("id", userId)
            .single()

          if (!profileError) {
            setTranslatorProfile(profileData)
          }
        }

        // Fetch orders
        let query = supabase.from("orders").select("*").order("created_at", { ascending: false })

        if (userData.role === "customer") {
          query = query.eq("customer_id", userId)
        } else if (userData.role === "translator") {
          // For translators, we need to get orders from assignments
          const { data: assignmentsData, error: assignmentsError } = await supabase
            .from("order_assignments")
            .select("order_id")
            .eq("translator_id", userId)

          if (!assignmentsError && assignmentsData.length > 0) {
            const orderIds = assignmentsData.map((a) => a.order_id)
            query = query.in("id", orderIds)
          } else {
            // No assignments, so no orders
            setOrders([])
            setLoading(false)
            return
          }
        }

        const { data: ordersData, error: ordersError } = await query

        if (!ordersError) {
          setOrders(ordersData || [])
        }
      } catch (error) {
        console.error("Error fetching user details:", error)
        setError("Failed to load user details")
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchUserDetails()
    }
  }, [supabase, userId, router, currentUser])

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Update user in the database
      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: fullName,
          email: email,
          role: role,
        })
        .eq("id", userId)

      if (updateError) throw updateError

      // Update local state
      setUser((prev) => {
        if (!prev) return null
        return {
          ...prev,
          full_name: fullName,
          email: email,
          role: role,
        }
      })

      setSuccess("User updated successfully")
    } catch (error) {
      console.error("Error updating user:", error)
      setError("Failed to update user")
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold">User not found</h3>
          <p className="mb-6 text-sm text-muted-foreground">The requested user could not be found</p>
          <Button onClick={() => router.push("/dashboard/admin/users")}>Back to Users</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Details</h1>
            <p className="text-muted-foreground">User ID: {user.id}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard/admin/users")}>
            Back to Users
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            {user.role === "translator" && <TabsTrigger value="translator">Translator Profile</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>View and edit user information</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="profile-form" onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={role}
                      onValueChange={(value) => setRole(value as "customer" | "translator" | "admin")}
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="translator">Translator</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Account Created</Label>
                    <div>{formatDate(user.created_at)}</div>
                  </div>
                </form>
              </CardContent>
              <CardFooter>
                <Button type="submit" form="profile-form" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>User Orders</CardTitle>
                <CardDescription>
                  {user.role === "customer"
                    ? "Orders created by this customer"
                    : user.role === "translator"
                      ? "Orders assigned to this translator"
                      : "Orders related to this user"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <h3 className="mb-2 text-lg font-semibold">No orders found</h3>
                    <p className="text-sm text-muted-foreground">This user has no associated orders</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Languages</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.id.slice(0, 8)}</TableCell>
                            <TableCell>{`${order.source_language} → ${order.target_language}`}</TableCell>
                            <TableCell>{formatDate(order.deadline)}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>${order.cost.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/admin/orders/${order.id}`)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {user.role === "translator" && (
            <TabsContent value="translator" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Translator Profile</CardTitle>
                  <CardDescription>Translator-specific information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {translatorProfile ? (
                    <>
                      <div className="space-y-2">
                        <Label>Rating</Label>
                        <div className="text-2xl font-bold">{translatorProfile.rating}/100</div>
                      </div>

                      <div className="space-y-2">
                        <Label>Languages</Label>
                        <div className="flex flex-wrap gap-2">
                          {translatorProfile.languages.map((language) => (
                            <Badge key={language} variant="secondary">
                              {language}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Expertise</Label>
                        <div className="flex flex-wrap gap-2">
                          {translatorProfile.expertise.map((expertise) => (
                            <Badge key={expertise} variant="outline">
                              {expertise}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {translatorProfile.custom_tags.length > 0 && (
                        <div className="space-y-2">
                          <Label>Custom Tags</Label>
                          <div className="flex flex-wrap gap-2">
                            {translatorProfile.custom_tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Availability</Label>
                        <div>
                          {translatorProfile.availability ? (
                            <Badge variant="success">Available</Badge>
                          ) : (
                            <Badge variant="secondary">Not Available</Badge>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                      <h3 className="mb-2 text-lg font-semibold">No translator profile</h3>
                      <p className="text-sm text-muted-foreground">This translator has not set up their profile yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
