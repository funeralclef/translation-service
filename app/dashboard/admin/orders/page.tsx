"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search } from "lucide-react"

interface Order {
  id: string
  customer_id: string
  source_language: string
  target_language: string
  deadline: string
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  cost: number
  created_at: string
  customer_name?: string
  translator_name?: string
}

export default function AdminOrders() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const supabase = createClientComponentClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("all")

  useEffect(() => {
    // Set initial tab based on URL parameter
    const statusParam = searchParams.get("status")
    if (statusParam && ["pending", "active", "completed"].includes(statusParam)) {
      setActiveTab(statusParam)
    }
  }, [searchParams])

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        if (!user || user.role !== "admin") {
          router.push("/dashboard")
          return
        }

        // Fetch all orders
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })

        if (ordersError) {
          throw ordersError
        }

        // Fetch customer names
        const customerIds = [...new Set(ordersData.map((order) => order.customer_id))]
        const { data: customersData, error: customersError } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", customerIds)

        if (customersError) {
          throw customersError
        }

        // Create a map of customer IDs to names
        const customerMap = new Map(customersData.map((customer) => [customer.id, customer.full_name]))

        // Fetch translator assignments
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("order_assignments")
          .select("order_id, translator_id")

        if (assignmentsError) {
          throw assignmentsError
        }

        // Create a map of order IDs to translator IDs
        const assignmentMap = new Map(
          assignmentsData.map((assignment) => [assignment.order_id, assignment.translator_id]),
        )

        // Fetch translator names
        const translatorIds = [...new Set(assignmentsData.map((assignment) => assignment.translator_id))]
        const { data: translatorsData, error: translatorsError } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", translatorIds)

        if (translatorsError) {
          throw translatorsError
        }

        // Create a map of translator IDs to names
        const translatorMap = new Map(translatorsData.map((translator) => [translator.id, translator.full_name]))

        // Combine all data
        const enrichedOrders = ordersData.map((order) => ({
          ...order,
          customer_name: customerMap.get(order.customer_id) || "Unknown",
          translator_name: assignmentMap.has(order.id)
            ? translatorMap.get(assignmentMap.get(order.id)) || "Unknown"
            : undefined,
        }))

        setOrders(enrichedOrders)
        setFilteredOrders(enrichedOrders)
      } catch (error) {
        console.error("Error fetching orders:", error)
        setError("Failed to load orders")
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [supabase, router, user])

  useEffect(() => {
    // Filter orders based on search query and active tab
    let filtered = orders

    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.translator_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.source_language.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.target_language.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (activeTab === "pending") {
      filtered = filtered.filter((order) => order.status === "pending")
    } else if (activeTab === "active") {
      filtered = filtered.filter((order) => ["assigned", "in_progress"].includes(order.status))
    } else if (activeTab === "completed") {
      filtered = filtered.filter((order) => order.status === "completed")
    }

    setFilteredOrders(filtered)
  }, [searchQuery, activeTab, orders])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Manage Orders</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search orders..."
              className="pl-8"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        <Tabs defaultValue={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">All Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({orders.filter((o) => o.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="active">
              Active ({orders.filter((o) => ["assigned", "in_progress"].includes(o.status)).length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({orders.filter((o) => o.status === "completed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredOrders.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <h3 className="mb-2 text-lg font-semibold">No orders found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "No orders match your search criteria"
                    : `No ${activeTab !== "all" ? activeTab : ""} orders found in the system`}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Translator</TableHead>
                      <TableHead>Languages</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id.slice(0, 8)}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{order.translator_name || "Not assigned"}</TableCell>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
