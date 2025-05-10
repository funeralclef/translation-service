"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutDashboard, FileText, PlusCircle, Settings, LogOut, Menu, X, User, Globe, ChevronDown } from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const role = user.role || "customer"

  const navigation = [
    { name: t("navigation.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    ...(role === "customer"
      ? [
          { name: t("navigation.myOrders"), href: "/dashboard/customer/orders", icon: FileText },
          { name: t("navigation.createOrder"), href: "/dashboard/customer/orders/create", icon: PlusCircle },
        ]
      : []),
    ...(role === "translator"
      ? [
          { name: t("navigation.availableJobs"), href: "/dashboard/translator/jobs", icon: FileText },
          { name: t("navigation.myTranslations"), href: "/dashboard/translator/translations", icon: FileText },
          { name: t("navigation.myProfile"), href: "/dashboard/translator/profile", icon: User },
        ]
      : []),
    ...(role === "admin"
      ? [
          { name: t("navigation.manageOrders"), href: "/dashboard/admin/orders", icon: FileText },
          { name: t("navigation.manageUsers"), href: "/dashboard/admin/users", icon: User },
        ]
      : []),
  ]

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Mobile menu */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b">
        <Link href="/dashboard" className="font-bold">
          {t("navigation.translationService")}
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar for desktop */}
        <aside className="hidden lg:flex w-64 flex-col border-r bg-gray-50 dark:bg-gray-900">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard" className="font-bold">
              {t("navigation.translationService")}
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                  pathname === item.href
                    ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
            
            {/* Settings Button */}
            <Link
              href="/dashboard/settings"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname === "/dashboard/settings"
                  ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <Settings className="mr-3 h-5 w-5" />
              {t("navigation.settings")}
            </Link>
            
            {/* Language Dropdown Button - Separate dropdown under settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center">
                    <Globe className="mr-3 h-5 w-5" />
                    {t("common.language")}
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem 
                  onClick={() => handleLanguageChange("en")}
                  className={language === "en" ? "bg-accent text-accent-foreground" : ""}
                >
                  {t("common.english")}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleLanguageChange("uk")}
                  className={language === "uk" ? "bg-accent text-accent-foreground" : ""}
                >
                  {t("common.ukrainian")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="border-t p-4">
            <div className="mb-2 flex items-center">
              <div className="ml-3">
                <p className="text-sm font-medium">{user.full_name || user.email}</p>
                <p className="text-xs text-gray-500 capitalize">{role === "customer" ? t("auth.customer") : role === "translator" ? t("auth.translator") : t("auth.admin")}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("common.signOut")}
            </Button>
          </div>
        </aside>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-white dark:bg-gray-900 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Link href="/dashboard" className="font-bold">
                  {t("navigation.translationService")}
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X size={24} />
                </Button>
              </div>
              <nav className="space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                      pathname === item.href
                        ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                ))}

                {/* Settings Button for Mobile */}
                <Link
                  href="/dashboard/settings"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                    pathname === "/dashboard/settings"
                      ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="mr-3 h-5 w-5" />
                  {t("navigation.settings")}
                </Link>
                
                {/* Language Options for Mobile */}
                <div className="space-y-1 mt-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500 px-3 py-1">
                    {t("common.language")}
                  </div>
                  <button
                    onClick={() => {
                      handleLanguageChange("en")
                      setMobileMenuOpen(false)
                    }}
                    className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium ${
                      language === "en"
                        ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {t("common.english")}
                  </button>
                  <button
                    onClick={() => {
                      handleLanguageChange("uk")
                      setMobileMenuOpen(false)
                    }}
                    className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium ${
                      language === "uk"
                        ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {t("common.ukrainian")}
                  </button>
                </div>
              </nav>
              <div className="absolute bottom-0 left-0 right-0 border-t p-4">
                <div className="mb-2 flex items-center">
                  <div className="ml-3">
                    <p className="text-sm font-medium">{user.full_name || user.email}</p>
                    <p className="text-xs text-gray-500 capitalize">{role === "customer" ? t("auth.customer") : role === "translator" ? t("auth.translator") : t("auth.admin")}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-start" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("common.signOut")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
