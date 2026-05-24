'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Chrome, Shield, Mail, Zap, LayoutGrid, CheckCircle2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        setCheckingSession(false)
      }
    }
    checkUser()
  }, [router, supabase])

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      alert(`Login failed: ${err.message || err}`)
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Glow Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none"></div>

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none"></div>

      {/* Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/30">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Assignly</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-indigo-400/90 font-semibold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full">v1.0 Release</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10 flex-grow">
        {/* Left: Headline & Auth card */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none">
              Assign tasks.<br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Notify instantly.
              </span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-lg leading-relaxed">
              Experience the next-generation task manager with seamless Google integration, automatic Gmail notification systems, and high-fidelity dashboards.
            </p>
          </div>

          {/* Social Proof Checklist */}
          <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Google OAuth 2.0</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Gmail SMTP Alerts</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Supabase Postgres</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Shadcn UI Dashboard</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-35 transition duration-500"></div>
            <div className="relative space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Start organizing today</h2>
                <p className="text-sm text-slate-400">Log in with your Gmail account to manage, create, and assign tasks with ease.</p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:bg-slate-200 text-slate-950 font-bold py-3.5 px-6 rounded-xl transition duration-300 shadow-xl relative overflow-hidden group/btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Chrome className="w-5 h-5 text-red-500 fill-red-500 group-hover/btn:scale-110 transition duration-300" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 justify-center text-xs text-slate-500 pt-2">
                <Shield className="w-4 h-4 text-emerald-500/80" />
                <span>Authorized secure connection with Supabase Guard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Premium UI Mockup Showcase */}
        <div className="lg:col-span-6 relative hidden lg:block">
          {/* Floating UI Elements */}
          <div className="relative bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md max-w-lg mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-xs font-mono text-slate-500">task_workspace_board.app</span>
            </div>

            {/* Kanban Columns Mockup */}
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-indigo-400 font-bold tracking-wider uppercase bg-indigo-500/10 px-2 py-0.5 rounded">In Progress</span>
                  <span className="text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded">High</span>
                </div>
                <h4 className="font-bold text-sm">Deploy Next.js Frontend to Vercel</h4>
                <p className="text-xs text-slate-400">Configure environments and set up seamless production deployments.</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-900/60 mt-2">
                  <span className="text-[10px] text-slate-500">Due: May 25, 2026</span>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">YK</div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-emerald-400 font-bold tracking-wider uppercase bg-emerald-500/10 px-2 py-0.5 rounded">Completed</span>
                  <span className="text-xs text-slate-400 font-bold bg-slate-500/10 px-2 py-0.5 rounded">Medium</span>
                </div>
                <h4 className="font-bold text-sm text-slate-400 line-through">Integrate Google SMTP for email notifications</h4>
                <p className="text-xs text-slate-500 line-through">Auto-deliver notifications to creators and assignees on updates.</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-900/60 mt-2">
                  <span className="text-[10px] text-slate-600">Completed</span>
                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold">S9</div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Gmail Mockup Notification Box */}
          <div className="absolute -bottom-8 -left-8 bg-slate-950/90 border border-indigo-500/30 p-4 rounded-xl shadow-2xl flex items-start gap-4 max-w-xs animate-bounce pointer-events-none backdrop-blur-md">
            <div className="bg-indigo-500/20 p-2.5 rounded-lg border border-indigo-500/30 shrink-0">
              <Mail className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <h5 className="font-bold text-xs text-white">Gmail Alert Received</h5>
              <p className="text-[10px] text-slate-400 leading-normal">"YK assigned you task: Deploy Next.js Frontend to Vercel."</p>
            </div>
          </div>
          
          {/* Floating Speed Badge */}
          <div className="absolute top-[-10px] right-[-15px] bg-slate-950/90 border border-emerald-500/30 p-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-xs pointer-events-none backdrop-blur-md">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400">Zero Server Latency</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-8 border-t border-slate-900 relative z-10 text-xs text-slate-600">
        <p>&copy; 2026 Assignly Task Systems. Powered by Supabase & Flask.</p>
      </footer>
    </div>
  )
}
