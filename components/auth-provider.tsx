"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getSession, logoutUser, type User } from "@/utils/auth"

interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => void
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  setUser: () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkSession = () => {
      const session = getSession()
      if (session?.user) {
        setUser(session.user)
      } else {
        setUser(null)
        // Redirect to login if on a protected route
        if (
          (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/translator")) &&
          !pathname.includes("/auth/")
        ) {
          router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`)
        }
      }
      setLoading(false)
    }

    checkSession()

    // Check session on focus to ensure it's up to date
    const handleFocus = () => {
      checkSession()
    }

    // Listen for storage events (for multi-tab logout)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "session") {
        checkSession()
      }
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [pathname, router])

  const logout = () => {
    logoutUser()
    setUser(null)
    router.push("/")
  }

  return <AuthContext.Provider value={{ user, loading, logout, setUser }}>{children}</AuthContext.Provider>
}
