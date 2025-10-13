"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db"

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const router = useRouter()

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        const role = session?.user?.user_metadata?.role
        if (role === "child") {
          // child → check if parent linked
          const { data } = await supabase.from("guardians").select("id").eq("child_uid", session?.user?.id).single()
          if (!data) router.push("/onboarding") // child can add parent later
          else router.push("/") // already linked → chat
        } else {
          // parent → check if children linked
          const { data } = await supabase.from("guardians").select("id").eq("email", session?.user?.email).single()
          if (!data) router.push("/onboarding") // first time → child setup
          else router.push("/guardian") // already linked → dashboard
        }
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}