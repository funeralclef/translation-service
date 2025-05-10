import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-bold">EchoPulse</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Register</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Professional Translation Services
              </h1>
              <p className="max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Connect with expert translators for high-quality translations in multiple languages.
              </p>
              <div className="space-x-4">
                <Link href="/auth/register">
                  <Button size="lg">Get Started</Button>
                </Link>
                <Link href="#features">
                  <Button variant="outline" size="lg">
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Features</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                Our platform offers a comprehensive set of features for customers, translators, and administrators.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-sm text-center">
                <h3 className="text-xl font-bold">For Customers</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload documents, select languages, set deadlines, and track your orders.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-sm text-center">
                <h3 className="text-xl font-bold">For Translators</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Find translation jobs that match your skills and expertise.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-sm text-center">
                <h3 className="text-xl font-bold">For Administrators</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage users, monitor orders, and oversee platform operations.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row md:px-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} EchoPulse. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
