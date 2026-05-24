'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, AlertTriangle } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace('/dashboard')
        } else {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
              router.replace('/dashboard')
            } else if (event === 'SIGNED_OUT') {
              router.replace('/')
            }
          })
          
          const timeout = setTimeout(() => {
            router.replace('/dashboard')
          }, 6000)
          
          return () => {
            subscription.unsubscribe()
            clearTimeout(timeout)
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Auth verification failed'
        setErrorMsg(msg)
      }
    }
    
    handleAuth()
  }, [router, supabase])

  const CustomSpinner = () => (
    <Loader2 size={48} className="animate-spin" style={{ color: 'var(--cream-600)', marginBottom: '24px' }} />
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px',
    }}>
      {/* Decorative grain & backgrounds */}
      <div className="grain"></div>
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,169,110,0.15) 0%, transparent 70%)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(143,188,139,0.12) 0%, transparent 70%)',
        pointerEvents: 'none'
      }}></div>

      {/* Card Container */}
      <div style={{
        background: 'rgba(253, 251, 247, 0.92)',
        border: '1px solid var(--cream-300)',
        borderRadius: '24px',
        padding: '48px 32px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(60,35,10,0.08), 0 4px 16px rgba(60,35,10,0.04)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10,
      }}>
        {errorMsg ? (
          <>
            <AlertTriangle size={40} style={{ stroke: 'var(--rose-dark)', marginBottom: '16px' }} />
            <h2 className="font-display" style={{ fontSize: '22px', color: 'var(--rose-dark)', marginBottom: '8px' }}>
              Authentication Failed
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted-text)', lineHeight: 1.6 }}>
              {errorMsg}
            </p>
            <button
              onClick={() => router.replace('/')}
              className="btn-primary"
              style={{ marginTop: '24px', padding: '10px 20px', fontSize: '13px' }}
            >
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            <CustomSpinner />
            <h2 className="font-display" style={{ fontSize: '22px', color: 'var(--cream-900)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
              Signing you in…
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted-text)', lineHeight: 1.6 }}>
              Setting up your secure workspace session.<br />Please wait a moment.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
