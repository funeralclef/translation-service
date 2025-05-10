"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import bcrypt from "bcryptjs"

export default function Settings() {
  const { user, setUser } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "")
      setEmail(user.email || "")
    }
  }, [user])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(false)

    if (!user) {
      setProfileError(t("settings.failedToUpdate"))
      setProfileLoading(false)
      return
    }

    try {
      // Update user in the database
      const { error } = await supabase
        .from("users")
        .update({
          full_name: fullName,
          email: email,
        })
        .eq("id", user.id)

      if (error) {
        throw error
      }

      // Update user in session
      const updatedUser = {
        ...user,
        full_name: fullName,
        email: email,
      }

      // Update local storage
      localStorage.setItem("session", JSON.stringify({ user: updatedUser }))

      // Update auth context
      setUser(updatedUser)

      setProfileSuccess(true)
    } catch (error) {
      console.error("Error updating profile:", error)
      setProfileError(t("settings.failedToUpdate"))
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordSuccess(false)

    if (!user) {
      setPasswordError(t("settings.failedToUpdatePassword"))
      setPasswordLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordsDoNotMatch"))
      setPasswordLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setPasswordError(t("settings.passwordMinLength"))
      setPasswordLoading(false)
      return
    }

    try {
      // Get current user with password
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("password")
        .eq("id", user.id)
        .single()

      if (userError || !userData) {
        throw userError || new Error("User not found")
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, userData.password)
      if (!passwordMatch) {
        setPasswordError(t("settings.currentPasswordIncorrect"))
        setPasswordLoading(false)
        return
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)

      // Update password in database
      const { error } = await supabase
        .from("users")
        .update({
          password: hashedPassword,
        })
        .eq("id", user.id)

      if (error) {
        throw error
      }

      setPasswordSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Error updating password:", error)
      setPasswordError(t("settings.failedToUpdatePassword"))
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{t("settings.accountSettings")}</h1>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">{t("navigation.profile")}</TabsTrigger>
            <TabsTrigger value="password">{t("navigation.password")}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.profileInformation")}</CardTitle>
                <CardDescription>{t("settings.updateProfile")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="profile-form" onSubmit={handleProfileUpdate} className="space-y-4">
                  {profileError && (
                    <Alert variant="destructive">
                      <AlertDescription>{profileError}</AlertDescription>
                    </Alert>
                  )}

                  {profileSuccess && (
                    <Alert className="mb-4">
                      <AlertDescription>{t("settings.profileUpdated")}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </form>
              </CardContent>
              <CardFooter>
                <Button type="submit" form="profile-form" disabled={profileLoading}>
                  {profileLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("settings.updating")}
                    </>
                  ) : (
                    t("settings.updateProfile")
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.passwordSettings")}</CardTitle>
                <CardDescription>{t("settings.updatePassword")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="password-form" onSubmit={handlePasswordUpdate} className="space-y-4">
                  {passwordError && (
                    <Alert variant="destructive">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  {passwordSuccess && (
                    <Alert className="mb-4">
                      <AlertDescription>{t("settings.passwordUpdated")}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t("settings.confirmNewPassword")}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </form>
              </CardContent>
              <CardFooter>
                <Button type="submit" form="password-form" disabled={passwordLoading}>
                  {passwordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("settings.updating")}
                    </>
                  ) : (
                    t("settings.updatePassword")
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
