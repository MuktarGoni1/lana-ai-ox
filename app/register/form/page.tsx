"use client"
import { useState, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/db"
import { ArrowRight, Check } from "lucide-react"
import { Mail, User } from "lucide-react"
import { Suspense } from "react"
import { useToast } from "@/hooks/use-toast"

function RegisterFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const role = searchParams.get("role") // "parent" or "child"

  const [sent, setSent] = useState(false)

  /* ---- PARENT FLOW ---- */
  if (role === "parent") {
    const [email, setEmail] = useState("")

    const handleParent = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) {
        toast({
          title: "Error",
          description: "Parent e-mail is required",
          variant: "destructive",
        })
        return
      }

      try {
        const { data, error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            data: { role: "guardian" }
          }
        })
        
        if (error) throw error
        
        // Also create a record in the guardians table
        await supabase.from("guardians").insert({
          email: email.trim(),
          weekly_report: true,
          monthly_report: false
        }).select()
        
        setSent(true)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to register. Please try again.",
          variant: "destructive",
        })
      }
    }

    if (sent) return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
        <div className="max-w-md text-center space-y-4">
          <Check className="w-12 h-12 mx-auto text-white/60" />
          <h1 className="text-2xl font-bold">Check your inbox</h1>
          <p className="text-white/60">We sent a magic link to {email}.</p>
          <button onClick={() => setSent(false)} className="text-sm text-white/50 hover:text-white">Use a different e-mail</button>
        </div>
      </div>
    )

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
        <form onSubmit={handleParent} className="flex flex-col gap-4 w-full max-w-sm">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6" />
            Parent sign-up
          </h1>
          <p className="text-white/60">No password needed — just check your inbox.</p>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@email.com"
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
            required
          />

          <button type="submit" className="px-4 py-2 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-all">
            Send magic link
            <ArrowRight className="w-4 h-4" />
          </button>

          <button type="button" onClick={() => router.push("/register")} className="text-sm text-white/50 hover:text-white">
            ← Back
          </button>
        </form>
      </div>
    )
  }

  /* ---- CHILD FLOW ---- */
  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState<number | "">("")
  const [grade, setGrade] = useState("")

  const handleChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname || !age || !grade) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      })
      return
    }

    try {
      const child_uid = crypto.randomUUID()
      const email = `${child_uid}@child.lana`
      const password = crypto.randomUUID()
      
      // Create the auth user
      const { data, error: signError } = await supabase.auth.signUp({
        email: email,
        password: child_uid, // Use child_uid as password for consistency
        options: { 
          data: { role: "child", nickname, age, grade },
        }
      })
      
      if (signError) throw signError

      // Store child row in users table
      const { error: insertError } = await supabase.from("users").insert({
        id: child_uid,
        email: email,
        user_metadata: { role: "child", nickname, age, grade }
      })
      
      if (insertError) throw insertError

      // Store session ID in localStorage for anonymous users
      localStorage.setItem('lana_sid', child_uid)
      
      router.push("/onboarding") // child can add parent later
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to register. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <form onSubmit={handleChild} className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" />
          Student sign-up
        </h1>
        <p className="text-white/60">No password needed — we’ll create a magic link.</p>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your nickname"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          required
        />

        <input
          type="number"
          min="6"
          max="18"
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          placeholder="Age"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          required
        />

        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          required
        >
          <option value="">Select grade</option>
          <option value="6">Grade 6</option>
          <option value="7">Grade 7</option>
          <option value="8">Grade 8</option>
          <option value="9">Grade 9</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
          <option value="12">Grade 12</option>
          <option value="college">College</option>
        </select>

        <button type="submit" className="px-4 py-2 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-all">
          Create account
          <ArrowRight className="w-4 h-4" />
        </button>

        <button type="button" onClick={() => router.push("/register")} className="text-sm text-white/50 hover:text-white">
          ← Back
        </button>
      </form>
    </div>
  )
}

export default function RegisterForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <RegisterFormContent />
    </Suspense>
  )
}