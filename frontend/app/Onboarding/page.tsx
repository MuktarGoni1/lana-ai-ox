"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState<number | "">("")
  const [grade, setGrade] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname || !age || !grade) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      })
      return
    }

    const session = await supabase.auth.getSession()
    if (!session.data.session) return router.push("/login")

    const parent_uid = session.data.session.user.id
    const child_uid = crypto.randomUUID() // anon child

    // 1. create child user (anon)
    await supabase.from("users").insert({
      id: child_uid,
      email: `${child_uid}@child.lana`,
      user_metadata: { role: "child", nickname, age, grade },
    })

    // 2. link parent → child
    await supabase.from("guardians").insert({
      email: session.data.session.user.email,
      child_uid,
      weekly_report: true,
      monthly_report: false,
    })

    router.push("/guardian")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
        <h1 className="text-3xl font-bold">Set up your child</h1>
        <p className="text-white/60">This helps Lana explain at the right level.</p>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Child’s nickname"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20"
          required
        />

        <input
          type="number"
          min="6"
          max="18"
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          placeholder="Age"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20"
          required
        />

            <select
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
        required
      >
        <option value="" className="bg-black text-white">Select grade</option>
        <option value="6" className="bg-black text-white">Grade 6</option>
        <option value="7" className="bg-black text-white">Grade 7</option>
        <option value="8" className="bg-black text-white">Grade 8</option>
        <option value="9" className="bg-black text-white">Grade 9</option>
        <option value="10" className="bg-black text-white">Grade 10</option>
        <option value="11" className="bg-black text-white">Grade 11</option>
        <option value="12" className="bg-black text-white">Grade 12</option>
        <option value="college" className="bg-black text-white">College</option>
      </select>

        <button type="submit" className="px-4 py-2 rounded-xl bg-white text-black font-medium">
          Finish setup
        </button>
      </form>
    </div>
  )
}