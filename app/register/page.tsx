"use client"
import { useRouter } from "next/navigation"
import { User, Mail } from "lucide-react"

export default function RegisterLanding() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          Who are you?
        </h1>
        <p className="text-white/60">Pick the path that fits you.</p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Parent path */}
          <button
            onClick={() => router.push("/register?role=parent")}
            className="p-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm transition-all duration-200 flex flex-col items-center gap-3"
          >
            <Mail className="w-8 h-8 text-white/60" />
            <span className="text-xl font-semibold">I’m a parent / guardian</span>
            <span className="text-sm text-white/60">Receive reports, manage learning</span>
          </button>

          {/* Child path */}
          <button
            onClick={() => router.push("/register?role=child")}
            className="p-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm transition-all duration-200 flex flex-col items-center gap-3"
          >
            <User className="w-8 h-8 text-white/60" />
            <span className="text-xl font-semibold">I’m a student</span>
            <span className="text-sm text-white/60">Learn, ask, explore</span>
          </button>
        </div>

        <button onClick={() => router.push("/login")} className="text-sm text-white/50 hover:text-white">
          Already have an account? Log in
        </button>
      </div>
    </div>
  )
}