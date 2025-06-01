"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useLanguage } from "@/components/language-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Users, Clock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export default function Dashboard() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClientComponentClient()

  // State for dashboard statistics
  const [stats, setStats] = useState({
    myOrders: 0,
    totalOrders: 0,
    totalUsers: 0,
    translationJobs: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      try {
        setStatsLoading(true)
        
        // Fetch statistics based on user role
        if (user.role === "customer") {
          // Fetch customer's orders count
          const { count: myOrdersCount } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("customer_id", user.id)

          setStats(prev => ({ ...prev, myOrders: myOrdersCount || 0 }))
        }

        if (user.role === "translator") {
          // Fetch available jobs for translator
          const { count: jobsCount } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .in("status", ["pending", "assigned"])

          setStats(prev => ({ ...prev, translationJobs: jobsCount || 0 }))
        }

        if (user.role === "admin") {
          // Fetch total orders and users count
          const [ordersResult, usersResult] = await Promise.all([
            supabase.from("orders").select("*", { count: "exact", head: true }),
            supabase.from("users").select("*", { count: "exact", head: true })
          ])

          setStats(prev => ({
            ...prev,
            totalOrders: ordersResult.count || 0,
            totalUsers: usersResult.count || 0,
          }))
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [user, supabase])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return null
  }

  const role = user.role
  const fullName = user.full_name || user.email

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.welcome")}, {fullName}</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {role === "customer" && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.myOrders")}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats.myOrders}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.totalOrdersCreated")}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => router.push("/dashboard/customer/orders")}
                  >
                    {t("dashboard.viewOrders")}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.createNewOrder")}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">{t("dashboard.uploadDocuments")}</p>
                  <Button className="w-full" onClick={() => router.push("/dashboard/customer/orders/create")}>
                    {t("dashboard.createOrder")}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {role === "translator" && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.translationJobs")}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats.translationJobs}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.availableActiveJobs")}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => router.push("/dashboard/translator/jobs")}
                  >
                    {t("dashboard.manageJobs")}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.myProfile")}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">{t("dashboard.setupTranslatorProfile")}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => router.push("/dashboard/translator/profile")}
                  >
                    {t("dashboard.manageProfile")}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {role === "admin" && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.totalOrders")}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats.totalOrders}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.ordersInSystem")}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => router.push("/dashboard/admin/orders")}
                  >
                    {t("dashboard.manageOrders")}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.users")}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats.totalUsers}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.registeredUsers")}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => router.push("/dashboard/admin/users")}
                  >
                    {t("dashboard.manageUsers")}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.accountSettings")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">{t("dashboard.updateProfilePreferences")}</p>
              <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard/settings")}>
                {t("dashboard.settings")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
