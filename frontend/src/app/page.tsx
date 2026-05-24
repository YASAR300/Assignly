'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { CheckCircle2, Sparkles, Loader2, FolderKanban, Mail, Lock } from 'lucide-react'

// Inline SVG icons to avoid lucide version mismatch
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.083 17.64 11.927 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

const CheckIcon = () => <CheckCircle2 size={14} style={{ stroke: 'var(--cream-700)', strokeWidth: '2px' }} />
const SparkleIcon = () => <Sparkles size={16} style={{ stroke: 'var(--cream-600)', strokeWidth: '1.5px' }} />

const KanbanIcon = () => <FolderKanban size={28} style={{ stroke: 'var(--cream-700)', strokeWidth: '1.8px' }} />

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Login failed: ${message}`)
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
        <p style={{ color: 'var(--muted-text)', fontSize: '14px' }}>Loading your workspace…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream-100)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Grain texture */}
      <div className="grain"></div>

      {/* Large decorative circles */}
      <div style={{
        position: 'absolute', top: '-120px', right: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,169,110,0.18) 0%, transparent 70%)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-80px', left: '-80px',
        width: '380px', height: '380px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(143,188,139,0.15) 0%, transparent 70%)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute', top: '40%', left: '20%',
        width: '200px', height: '200px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,169,110,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }}></div>

      {/* Nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <KanbanIcon />
          <span className="font-display" style={{ fontSize: '22px', color: 'var(--cream-800)', letterSpacing: '-0.3px' }}>Assignly</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', borderRadius: '999px', padding: '6px 12px 6px 8px' }}>
          <SparkleIcon />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cream-700)', letterSpacing: '0.03em' }}>v1.0 — Now Live</span>
        </div>
      </nav>

      {/* Main hero */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center', maxWidth: '1100px', width: '100%' }}>

          {/* LEFT: copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-up">
            {/* Eyebrow */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--amber-light)', border: '1px solid #EDD9B8', borderRadius: '999px', padding: '6px 14px', width: 'fit-content' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber-dark)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> Task Management Re-imagined
              </span>
            </div>

            {/* Headline */}
            <div>
              <h1 className="font-display" style={{ fontSize: '52px', lineHeight: 1.08, color: 'var(--cream-900)', marginBottom: '16px', letterSpacing: '-1px' }}>
                Work feels calm<br />
                <span className="shimmer-text" style={{ fontStyle: 'italic' }}>when it's organised.</span>
              </h1>
              <p style={{ fontSize: '17px', color: 'var(--mid-text)', lineHeight: 1.7, maxWidth: '440px' }}>
                A beautiful workspace to create, assign, and complete tasks — with automatic Gmail notifications that keep your whole team in sync.
              </p>
            </div>

            {/* Feature checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Sign in with Google in one click',
                'Assign tasks to any team member',
                'Gmail notifications — instantly delivered',
                'Kanban board with live status tracking',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckIcon />
                  <span style={{ fontSize: '14px', color: 'var(--mid-text)' }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex' }}>
                {['#C9A96E','#8FBC8B','#7EB0CC','#D98080'].map((c, i) => (
                  <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: '2px solid var(--cream-100)', marginLeft: i === 0 ? 0 : '-8px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                    {['Y','A','S','H'][i]}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted-text)' }}>Loved by growing teams everywhere</p>
            </div>
          </div>

          {/* RIGHT: login card */}
          <div style={{ animationDelay: '0.15s' }} className="animate-fade-up">
            {/* Card */}
            <div style={{
              background: 'rgba(253,251,247,0.90)',
              border: '1px solid var(--cream-300)',
              borderRadius: '28px',
              padding: '44px 40px',
              boxShadow: '0 24px 64px rgba(60,35,10,0.12), 0 4px 16px rgba(60,35,10,0.06)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Decorative top corner accent */}
              <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'radial-gradient(circle at top right, rgba(201,169,110,0.15), transparent 70%)', pointerEvents: 'none' }}></div>

              {/* Heading */}
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ width: '52px', height: '52px', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', borderRadius: '16px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <KanbanIcon />
                </div>
                <h2 className="font-display" style={{ fontSize: '26px', color: 'var(--cream-900)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
                  Welcome back
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--muted-text)', lineHeight: 1.6 }}>
                  Sign in with your Google account to access<br />your workspace and team tasks.
                </p>
              </div>

              {/* Google button */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  background: loading ? 'var(--cream-200)' : 'white',
                  border: '1.5px solid var(--cream-300)',
                  borderRadius: '14px',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--warm-text)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(60,35,10,0.08)',
                  fontFamily: 'DM Sans, sans-serif',
                  marginBottom: '20px',
                }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cream-50)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cream-400)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(60,35,10,0.12)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}}
                onMouseLeave={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = 'white'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cream-300)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(60,35,10,0.08)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /><span>Redirecting to Google…</span></>
                ) : (
                  <><GoogleIcon /><span>Continue with Google</span></>
                )}
              </button>

              {/* Divider */}
              <div className="divider" style={{ marginBottom: '20px' }}>
                <span>New to Assignly?</span>
              </div>

              {/* Register info */}
              <div style={{ background: 'var(--sand-100)', border: '1px solid var(--cream-300)', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', background: 'var(--cream-200)', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-600)' }}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warm-text)', marginBottom: '4px' }}>No registration needed</p>
                  <p style={{ fontSize: '12px', color: 'var(--muted-text)', lineHeight: 1.5 }}>
                    Your account is created automatically when you sign in with Google for the first time. No forms, no passwords.
                  </p>
                </div>
              </div>

              {/* Privacy note */}
              <p style={{ fontSize: '11px', color: 'var(--muted-text)', textAlign: 'center', marginTop: '20px', lineHeight: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Lock size={11} /> Secured by Supabase Auth · We never store your Google password
              </p>
            </div>

            {/* Below card floating badge */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '20px',
              gap: '8px',
              flexWrap: 'wrap',
            }}>
              {[
                { icon: <Mail size={14} style={{ stroke: 'var(--cream-700)' }} />, label: 'Gmail Alerts' },
                { icon: <FolderKanban size={14} style={{ stroke: 'var(--cream-700)' }} />, label: 'Kanban Board' },
                { icon: <Lock size={14} style={{ stroke: 'var(--cream-700)' }} />, label: 'Google OAuth' },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--cream-200)', border: '1px solid var(--cream-300)', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', color: 'var(--mid-text)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid var(--cream-300)', position: 'relative', zIndex: 10 }}>
        <p style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
          © 2026 Assignly · Built with Next.js, Flask &amp; Supabase
        </p>
      </footer>
    </div>
  )
}
