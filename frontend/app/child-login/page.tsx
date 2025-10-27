"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db"

export default function ChildLoginPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return router.push("/login")
      const role = session.user.user_metadata?.role
      if (role === "child") router.push("/") // already onboarded
      else router.push("/onboarding")        // parent → setup
    })
  }, [router])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <h1 className="text-3xl font-bold">Child login</h1>
      <p className="text-white/60 mt-2">Use the magic link your parent shared.</p>
      {/* same magic-link form as parent */}
    </div>
  )
}