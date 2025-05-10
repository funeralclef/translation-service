import { createClientComponentClient } from "./supabase/client"
import bcrypt from "bcryptjs"

export interface User {
  id: string
  email: string
  full_name: string
  role: "customer" | "translator" | "admin"
}

export interface Session {
  user: User
}

// Register a new user
export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  role: "customer" | "translator" | "admin",
): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createClientComponentClient()

    // Check if user already exists
    const { data: existingUser } = await supabase.from("users").select("*").eq("email", email).single()

    if (existingUser) {
      return { user: null, error: "User with this email already exists" }
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Insert the new user
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email,
        password: hashedPassword,
        full_name: fullName,
        role,
      })
      .select()
      .single()

    if (error) {
      console.error("Registration error:", error)
      return { user: null, error: "Failed to register user" }
    }

    // Create session
    const user: User = {
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
    }

    // Store session in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("session", JSON.stringify({ user }))

      // Also set in cookie for middleware
      document.cookie = `session=${JSON.stringify({ user })};path=/;max-age=2592000` // 30 days
    }

    return { user, error: null }
  } catch (error) {
    console.error("Registration error:", error)
    return { user: null, error: "An unexpected error occurred" }
  }
}

// Login a user
export async function loginUser(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createClientComponentClient()

    // Get user by email
    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).single()

    if (error || !user) {
      return { user: null, error: "Invalid email or password" }
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return { user: null, error: "Invalid email or password" }
    }

    // Create session
    const sessionUser: User = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    }

    // Store session in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("session", JSON.stringify({ user: sessionUser }))

      // Also set in cookie for middleware
      document.cookie = `session=${JSON.stringify({ user: sessionUser })};path=/;max-age=2592000` // 30 days
    }

    return { user: sessionUser, error: null }
  } catch (error) {
    console.error("Login error:", error)
    return { user: null, error: "An unexpected error occurred" }
  }
}

// Get current session
export function getSession(): Session | null {
  if (typeof window === "undefined") {
    return null
  }

  const sessionStr = localStorage.getItem("session")
  if (!sessionStr) {
    return null
  }

  try {
    return JSON.parse(sessionStr) as Session
  } catch {
    return null
  }
}

// Logout user
export function logoutUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("session")

    // Also clear cookie
    document.cookie = "session=;path=/;max-age=0"
  }
}
