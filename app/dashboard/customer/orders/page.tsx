"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Order {
  id: string
  created_at: string
  source_language: string
  target_language: string
  deadline: string
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  tags: string[]
  comment: string
  document_url: string
  cost: number
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Fetch orders for the current user
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching orders:", error)
          setError("Failed to load orders. Please try again later.")
        } else {
          setOrders((data as unknown as Order[]) || [])
        }
      } catch (err) {
        console.error("Error fetching orders:", err)
        setError("An unexpected error occurred. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [supabase, user])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">{t("orders.pending")}</Badge>
      case "assigned":
        return <Badge variant="secondary">{t("orders.assignedStatus")}</Badge>
      case "in_progress":
        return <Badge variant="default">{t("orders.inProgressStatus")}</Badge>
      case "completed":
        return <Badge variant="success">{t("orders.completedStatus")}</Badge>
      case "cancelled":
        return <Badge variant="destructive">{t("orders.cancelledStatus")}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{t("orders.myOrders")}</h1>
          <Button onClick={() => router.push("/dashboard/customer/orders/create")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("orders.createOrder")}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold">{t("orders.noOrdersYet")}</h3>
            <p className="mb-6 text-sm text-muted-foreground">{t("orders.noOrdersDescription")}</p>
            <Button onClick={() => router.push("/dashboard/customer/orders/create")}>{t("orders.createFirstOrder")}</Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <div className="border-b bg-muted/50">
              <div className="grid grid-cols-7 gap-4 p-4 font-medium text-sm">
                <div className="min-w-0">{t("orders.id")}</div>
                <div className="min-w-0">{t("orders.created")}</div>
                <div className="min-w-0">{t("orders.languages")}</div>
                <div className="min-w-0">{t("orders.deadline")}</div>
                <div className="min-w-0">{t("orders.status")}</div>
                <div className="min-w-0">{t("orders.cost")}</div>
                <div className="min-w-0 text-right">{t("orders.actions")}</div>
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-24rem)] min-h-[300px] max-h-[800px]">
              <div className="divide-y">
                {orders.map((order) => (
                  <div key={order.id} className="grid grid-cols-7 gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 font-medium text-sm truncate">{order.id.slice(0, 8)}</div>
                    <div className="min-w-0 text-sm truncate">{formatDate(order.created_at)}</div>
                    <div className="min-w-0 text-sm truncate">{`${order.source_language} → ${order.target_language}`}</div>
                    <div className="min-w-0 text-sm truncate">{formatDate(order.deadline)}</div>
                    <div className="min-w-0">{getStatusBadge(order.status)}</div>
                    <div className="min-w-0 text-sm truncate">${order.cost.toFixed(2)}</div>
                    <div className="min-w-0 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/customer/orders/${order.id}`)}
                      >
                        {t("orders.view")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
