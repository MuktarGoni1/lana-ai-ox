"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Moon, User, LogOut } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser]           = useState<any>(null)
  const [role, setRole]           = useState<"child" | "guardian" | null>(null)
  const [weekly, setWeekly]       = useState(true)
  const [monthly, setMonthly]     = useState(false)
  const [parentEmail, setParentEmail] = useState("")
  const [dark, setDark]           = useState(false)

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    // =====  REAL CHECK - NO DEVELOPMENT BYPASS  =====
    // Settings page is only for authenticated users
    if (!session) return router.push("/login")
    const meta = session.user.user_metadata
    setUser(session.user)
    setRole(meta?.role ?? "child")
    setParentEmail(meta?.guardian_email ?? "")
    setDark(localStorage.getItem("theme") === "dark")
    if (meta?.role === "guardian") loadParentPrefs()
  })
}, [router])

  async function loadParentPrefs() {
    const { data } = await supabase
      .from("guardians")
      .select("weekly_report, monthly_report")
      .eq("email", user.email)
      .single()
    if (data) { setWeekly(data.weekly_report); setMonthly(data.monthly_report); }
  }

async function toggleDark(checked: boolean) {
  setDark(checked)
  localStorage.setItem("theme", checked ? "dark" : "light")
  document.documentElement.classList.toggle("dark", checked)
}

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-3xl font-bold">Settings</h1>

        {/* ----- Universal ----- */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Moon className="w-5 h-5" />Appearance</h2>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <Label>Dark mode</Label>
            <Switch checked={dark} onCheckedChange={toggleDark} />
          </div>
        </section>

        {/* ----- Reports (child = view-only) ----- */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><User className="w-5 h-5" />Reports</h2>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 opacity-60">
            <Label>Weekly report</Label>
            <Switch checked={weekly} disabled={role === "child"} />
            {role === "child" && <span className="text-xs text-white/50 ml-2">Ask parent</span>}
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 opacity-60">
            <Label>Monthly report</Label>
            <Switch checked={monthly} disabled={role === "child"} />
            {role === "child" && <span className="text-xs text-white/50 ml-2">Ask parent</span>}
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <Label className="text-white/70">Parent / Guardian e-mail</Label>
            <p className="text-sm mt-1">{parentEmail || "Not linked"}</p>
          </div>
        </section>

        {/* ----- Parent full controls ----- */}
        {role === "guardian" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Parent controls</h2>
            <button
              onClick={async () => {
                await supabase.from("guardians").update({ weekly_report: !weekly }).eq("email", user.email)
                setWeekly(!weekly)
              }}
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-left"
            >
              {weekly ? "Switch to monthly" : "Switch to weekly"}
            </button>
          </section>
        )}

        {/* ----- Sign out ----- */}
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.push("/login")
          }}
          className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}