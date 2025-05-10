// This file should only be imported in server components
import { cookies } from "next/headers"
import type { Session } from "./auth"

// Server-side session check
export async function getServerSession() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get("session")?.value

  if (!sessionCookie) {
    return null
  }

  try {
    return JSON.parse(sessionCookie) as Session
  } catch {
    return null
  }
} 