'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleAuth = async () => {
      // Fetch session immediately
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            router.replace('/dashboard')
          } else if (event === 'SIGNED_OUT') {
            router.replace('/')
          }
        })
        
        // Safety fallback redirect
        const timeout = setTimeout(() => {
          router.replace('/dashboard')
        }, 6000)
        
        return () => {
          subscription.unsubscribe()
          clearTimeout(timeout)
        }
      }
    }
    
    handleAuth()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <h2 className="text-xl font-bold tracking-tight">Completing Google authentication...</h2>
      <p className="text-slate-400 text-sm mt-2">Setting up your secure workspace session</p>
    </div>
  )
}
