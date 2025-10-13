"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { User, BookOpen, Calendar, Mail, Copy, Check } from "lucide-react"

export default function GuardianDashboard() {
  const router = useRouter()
  const [children, setChildren] = useState<any[]>([])
  const [parentEmail, setParentEmail] = useState("")
  const [copied, setCopied] = useState(false)

  /* ---- auth ---- */
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return router.push("/login")
    const email = session.user.email
    setParentEmail(email ?? "")
    if (email) loadChildren(email)
  })
}, [router])

  /* ---- data ---- */
  async function loadChildren(email: string) {
    const { data } = await supabase
      .from("guardians")
      .select("child_uid, weekly_report, monthly_report")
      .eq("email", email)
    if (!data) return
    const kids = await Promise.all(
      data.map(async (g) => {
        // Fetch child email from the public users table instead of admin API
        const { data: userRow } = await supabase
          .from("users")
          .select("email")
          .eq("id", g.child_uid)
          .single()

        const { data: searches } = await supabase
          .from("searches")
          .select("title,created_at")
          .eq("uid", g.child_uid)
          .order("created_at", { ascending: false })
          .limit(10)

        return {
          ...g,
          email: userRow?.email ?? "Anonymous child",
          searches: searches ?? [],
        }
      })
    )
    setChildren(kids)
  }

  async function toggleWeekly(child_uid: string, checked: boolean) {
    await supabase.from("guardians").update({ weekly_report: checked }).eq("child_uid", child_uid)
    loadChildren(parentEmail)
  }
  async function toggleMonthly(child_uid: string, checked: boolean) {
    await supabase.from("guardians").update({ monthly_report: checked }).eq("child_uid", child_uid)
    loadChildren(parentEmail)
  }

  async function copyInvite() {
    const link = `${window.location.origin}/register`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement("input")
      input.value = link
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  /* ---- empty state ---- */
  if (!children.length)
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
        <div className="max-w-lg text-center space-y-6">
          <Mail className="w-14 h-14 mx-auto text-white/40 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            No children linked
          </h1>
          <p className="text-white/60 leading-relaxed">
            Ask your child to add your e-mail in Settings, or send them the link below.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={copyInvite}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-200 flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy invite link"}
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-5 py-2.5 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all duration-200"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    )

  /* ---- loaded state ---- */
  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 flex items-center gap-3">
            <Mail className="w-8 h-8 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
            Parent Dashboard
          </h1>
          <p className="text-sm text-white/50">{parentEmail}</p>
        </div>

        {/* children grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {children.map((kid) => (
            <div
              key={kid.child_uid}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-200"
            >
              {/* child header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-white/60" />
                  <span className="font-semibold">{kid.email}</span>
                </div>
                <span className="text-xs text-white/50">UID {kid.child_uid.slice(0, 8)}…</span>
              </div>

              {/* toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-white/80">Weekly report</Label>
                  <Switch checked={kid.weekly_report} onCheckedChange={(c) => toggleWeekly(kid.child_uid, c)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-white/80">Monthly report</Label>
                  <Switch checked={kid.monthly_report} onCheckedChange={(c) => toggleMonthly(kid.child_uid, c)} />
                </div>
              </div>

              {/* recent searches */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />Recent searches
                </h3>
                <ul className="list-disc list-inside text-sm text-white/80 space-y-1">
                  {kid.searches.map((s: any) => (
                    <li key={s.created_at}>{s.title}</li>
                  ))}
                </ul>
                {!kid.searches.length && <p className="text-white/50">No searches yet.</p>}
              </div>
            </div>
          ))}
        </div>

        {/* footer actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/50">Updates in real-time</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}