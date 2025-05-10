import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Check auth status
  const { pathname } = request.nextUrl
  const session = request.cookies.get("session")?.value

  // Protected routes that require authentication
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/translator")) {
    if (!session) {
      const redirectUrl = new URL("/auth/login", request.url)
      redirectUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(redirectUrl)
    }

    try {
      // Parse session to get user role
      const { user } = JSON.parse(session)
      const userRole = user.role

      // Role-based access control
      if (pathname.startsWith("/dashboard/customer") && userRole !== "customer") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }

      if (pathname.startsWith("/dashboard/translator") && userRole !== "translator") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }

      if (pathname.startsWith("/dashboard/admin") && userRole !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    } catch (error) {
      // If session is invalid, redirect to login
      const redirectUrl = new URL("/auth/login", request.url)
      redirectUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Auth routes are only accessible when not logged in
  if ((pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register")) && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*", "/admin/:path*", "/translator/:path*"],
}
