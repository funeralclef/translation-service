"use client"

import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Users, Clock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useState, useEffect } from "react"
import { createClientComponentClient } from "@/utils/supabase/client"

export default function AdminDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalTranslators: 0,
    totalOrders: 0,
    pendingOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
  })

  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch user stats
        const { count: totalUsers, error: usersCountError } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })

        if (usersCountError) throw usersCountError

        const { data: userRoles, error: usersError } = await supabase.from("users").select("role")

        if (usersError) throw usersError

        const totalCustomers = userRoles.filter((u) => u.role === "customer").length
        const totalTranslators = userRoles.filter((u) => u.role === "translator").length

        // Fetch order stats
        const { count: totalOrders, error: ordersCountError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })

        if (ordersCountError) throw ordersCountError

        // Fetch pending orders count
        const { count: pendingOrders, error: pendingError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")

        if (pendingError) throw pendingError

        // Fetch active orders count
        const { count: activeOrders, error: activeError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .in("status", ["assigned", "in_progress"])

        if (activeError) throw activeError

        // Fetch completed orders count
        const { count: completedOrders, error: completedError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")

        if (completedError) throw completedError

        setStats({
          totalUsers: totalUsers || 0,
          totalCustomers,
          totalTranslators,
          totalOrders: totalOrders || 0,
          pendingOrders: pendingOrders || 0,
          activeOrders: activeOrders || 0,
          completedOrders: completedOrders || 0,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoadingStats(false)
      }
    }

    if (user && user.role === "admin") {
      fetchStats()
    }
  }, [supabase, user])

  if (loading || loadingStats) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user || user.role !== "admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalCustomers} customers, {stats.totalTranslators} translators
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => router.push("/dashboard/admin/users")}>
                Manage Users
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingOrders} pending, {stats.activeOrders} active, {stats.completedOrders} completed
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => router.push("/dashboard/admin/orders")}>
                Manage Orders
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingOrders}</div>
              <p className="text-xs text-muted-foreground">Orders awaiting translator assignment</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => router.push("/dashboard/admin/orders?status=pending")}
              >
                View Pending Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
