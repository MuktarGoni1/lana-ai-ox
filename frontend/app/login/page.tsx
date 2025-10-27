"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { Mail, ArrowRight } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your e-mail",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithOtp({ 
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      })
      
      if (error) throw error
      
      // Store email in localStorage to help with confirmation
      localStorage.setItem('login_email', email.trim())
      
      setSent(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (sent) return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <div className="max-w-md text-center space-y-4">
        <Mail className="w-12 h-12 mx-auto text-white/60" />
        <h1 className="text-2xl font-bold">Check your inbox</h1>
        <p className="text-white/60">We sent a magic link to {email}.</p>
        <button onClick={() => setSent(false)} className="text-sm text-white/50 hover:text-white">Use a different e-mail</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6" />
          Log in
        </h1>
        <p className="text-white/60">Parents and students — no password needed.</p>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          required
        />

        <button type="submit" className="px-4 py-2 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-all">
          Send magic link
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-white/50 text-center">No password — just check your inbox.</p>
      </form>
    </div>
  )
}