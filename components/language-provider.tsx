"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { translations, type Translation } from "@/utils/i18n/translations"

type LanguageContextType = {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: () => "",
})

export const useLanguage = () => useContext(LanguageContext)

type LanguageProviderProps = {
  children: React.ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<string>("en")

  useEffect(() => {
    // Load language preference from localStorage on component mount
    const storedLanguage = localStorage.getItem("language")
    if (storedLanguage) {
      setLanguageState(storedLanguage)
    } else {
      // Set default based on browser language if available
      const browserLang = navigator.language.split("-")[0]
      if (browserLang === "uk") {
        setLanguageState("uk")
      }
    }
  }, [])

  const setLanguage = (lang: string) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
    // Optional: update html lang attribute
    document.documentElement.lang = lang
  }

  // Translation function that looks up the key in our translations
  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = translations[language]

    for (const k of keys) {
      if (value === undefined) {
        return key // Return key if translation is missing
      }
      value = value[k]
    }

    if (typeof value !== "string") {
      return key // Return key if the value is not a string
    }

    return value
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
} 