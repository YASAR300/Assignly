'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { Plus, Search, LogOut, Trash2, Mail, Calendar, FolderKanban, Zap, CheckCircle2, Users, Loader2, Sparkles } from 'lucide-react'

// ── Interfaces ─────────────────────────────────────
interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string
}

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_by: string
  assigned_to: string | null
  created_at: string
  creator_name: string
  assignee_name: string
  assignee_email: string | null
  assignee_avatar: string | null
}

// ── Lucide Icon Adaptors ───────────────────────────
const Logo = () => <FolderKanban size={24} style={{ stroke: 'var(--cream-700)' }} />

const PlusIcon = () => <Plus size={16} />
const SearchIcon = () => <Search size={15} style={{ stroke: 'var(--muted-text)' }} />
const LogOutIcon = () => <LogOut size={15} />
const TrashIcon = () => <Trash2 size={14} />
const MailIcon = () => <Mail size={14} style={{ stroke: 'var(--cream-600)' }} />
const CalIcon = () => <Calendar size={12} style={{ stroke: 'var(--muted-text)' }} />

// ── Helpers ─────────────────────────────────────────
const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

const avatarColor = (name: string) => {
  const colors = ['#C9A96E','#8FBC8B','#7EB0CC','#D98080','#A88DC9','#C9A96E']
  return colors[name.charCodeAt(0) % colors.length]
}

const fmtDate = (d: string | null) => {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Column definitions
const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: '#E8D9BC', dot: '#C9A96E',  emptyMsg: 'No tasks yet. Create your first one!' },
  { id: 'in_progress', label: 'In Progress',  color: '#DCE8F0', dot: '#7EB0CC',  emptyMsg: 'No tasks in progress right now.' },
  { id: 'completed',   label: 'Completed',    color: '#D4E6D3', dot: '#8FBC8B',  emptyMsg: 'Complete a task to see it here!' },
]

// ── Component ────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Form state
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' })
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '' })

  // ── Auth ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setSession(session)
      setUserProfile(session.user)
      setAuthLoading(false)
    })
  }, [router, supabase])

  // ── API helpers ──────────────────────────────────
  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }), [session])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'err') {
      toast.error(msg)
    } else {
      toast.success(msg)
    }
  }

  const fetchTasks = useCallback(async () => {
    if (!session) return
    setLoadingTasks(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks`, { headers: headers() })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      setTasks(await res.json())
    } catch { showToast('Could not load tasks', 'err') }
    finally { setLoadingTasks(false) }
  }, [session, headers])

  const fetchUsers = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users`, { headers: headers() })
      if (res.ok) setUsers(await res.json())
    } catch { /* silent */ }
  }, [session, headers])

  useEffect(() => {
    if (!session) return
    fetchTasks()
    fetchUsers()
  }, [session, fetchTasks, fetchUsers])

  // ── Actions ──────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setActionLoading(true)
    try {
      const body = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: form.assigned_to || null,
        status: 'todo',
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' })
      setIsCreateOpen(false)
      await fetchTasks()
      showToast('Task created! Email notification sent.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      showToast(message, 'err')
    } finally { setActionLoading(false) }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t))
      if (newStatus === 'completed') showToast('Task completed! Email notifications sent.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      showToast(message, 'err')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteForm.email.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          full_name: inviteForm.full_name.trim(),
          email: inviteForm.email.trim(),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      setInviteForm({ full_name: '', email: '' })
      setIsInviteOpen(false)
      await fetchUsers()
      showToast('Teammate added successfully!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      showToast(message, 'err')
    } finally { setActionLoading(false) }
  }

  const handleAssigneeChange = async (taskId: string, newAssigneeId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ assigned_to: newAssigneeId || null }),
      })
      if (!res.ok) throw new Error('Assignee update failed')
      await fetchTasks()
      showToast('Assignee updated! Email notification sent.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      showToast(message, 'err')
    }
  }

  const handleDelete = async (task: Task) => {
    if (task.created_by !== userProfile?.id) { showToast('Only the creator can delete this task', 'err'); return }
    if (!confirm(`Delete "${task.title}"?`)) return
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks/${task.id}`, {
        method: 'DELETE', headers: headers(),
      })
      if (!res.ok) throw new Error('Delete failed')
      setTasks(prev => prev.filter(t => t.id !== task.id))
      showToast('Task deleted')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      showToast(message, 'err')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // ── Derived state ────────────────────────────────
  const filtered = tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter
    const matchScope =
      scopeFilter === 'all' ? true :
      scopeFilter === 'mine' ? t.assigned_to === userProfile?.id :
      t.created_by === userProfile?.id
    return matchSearch && matchPriority && matchScope
  })

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'completed').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // ── Loading screen ───────────────────────────────
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream-100)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes skeleton-pulse {
          0% { opacity: 0.65; }
          50% { opacity: 0.35; }
          100% { opacity: 0.65; }
        }
        .sk-pulse {
          animation: skeleton-pulse 1.5s infinite ease-in-out;
        }
      `}</style>
      <div className="grain"></div>

      {/* Navbar Skeleton */}
      <nav style={{ background: 'var(--cream-50)', borderBottom: '1px solid var(--cream-300)', height: '64px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="sk-pulse" style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--cream-400)' }}></div>
            <div className="sk-pulse" style={{ width: '80px', height: '18px', borderRadius: '4px', background: 'var(--cream-400)' }}></div>
          </div>
          {/* Profile card skeleton */}
          <div className="sk-pulse" style={{ width: '140px', height: '36px', borderRadius: '999px', background: 'var(--cream-300)' }}></div>
        </div>
      </nav>

      {/* Main Skeleton */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="sk-pulse" style={{ width: '220px', height: '30px', borderRadius: '6px', background: 'var(--cream-400)', marginBottom: '8px' }}></div>
            <div className="sk-pulse" style={{ width: '280px', height: '14px', borderRadius: '4px', background: 'var(--cream-300)' }}></div>
          </div>
          <div className="sk-pulse" style={{ width: '110px', height: '40px', borderRadius: '12px', background: 'var(--cream-400)' }}></div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="sk-pulse" style={{ width: '70px', height: '12px', borderRadius: '3px', background: 'var(--cream-300)' }}></div>
                <div className="sk-pulse" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--cream-300)' }}></div>
              </div>
              <div className="sk-pulse" style={{ width: '40px', height: '28px', borderRadius: '4px', background: 'var(--cream-400)' }}></div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="sk-pulse" style={{ width: '100px', height: '12px', borderRadius: '3px', background: 'var(--cream-300)' }}></div>
              <div className="sk-pulse" style={{ width: '30px', height: '12px', borderRadius: '3px', background: 'var(--cream-300)' }}></div>
            </div>
            <div style={{ height: '8px', background: 'var(--cream-200)', borderRadius: '999px', overflow: 'hidden' }}>
              <div className="sk-pulse" style={{ height: '100%', width: '35%', background: 'var(--cream-400)', borderRadius: '999px' }}></div>
            </div>
          </div>
        </div>

        {/* Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[1, 2, 3].map(colIdx => (
            <div key={colIdx} style={{ background: 'rgba(244, 237, 224, 0.35)', border: '1px solid var(--cream-300)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '350px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div className="sk-pulse" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--cream-400)' }}></div>
                <div className="sk-pulse" style={{ width: '85px', height: '14px', borderRadius: '4px', background: 'var(--cream-400)' }}></div>
              </div>

              {/* Cards */}
              {[1, 2].map(cardIdx => (
                <div key={cardIdx} style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="sk-pulse" style={{ width: '45px', height: '18px', borderRadius: '999px', background: 'var(--cream-300)' }}></div>
                    <div className="sk-pulse" style={{ width: '60px', height: '22px', borderRadius: '8px', background: 'var(--cream-300)' }}></div>
                  </div>
                  <div className="sk-pulse" style={{ width: '80%', height: '16px', borderRadius: '4px', background: 'var(--cream-400)' }}></div>
                  <div className="sk-pulse" style={{ width: '95%', height: '12px', borderRadius: '3px', background: 'var(--cream-300)' }}></div>
                  <div style={{ borderTop: '1px solid var(--cream-200)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="sk-pulse" style={{ width: '55px', height: '12px', borderRadius: '3px', background: 'var(--cream-300)' }}></div>
                    <div className="sk-pulse" style={{ width: '65px', height: '20px', borderRadius: '999px', background: 'var(--cream-300)' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  )

  const userName = userProfile?.user_metadata?.full_name || userProfile?.user_metadata?.name || 'Collaborator'
  const userAvatar = userProfile?.user_metadata?.avatar_url || userProfile?.user_metadata?.picture

  // ── Render ────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream-100)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="grain"></div>

      {/* ── Navbar ───────────────────────────────── */}
      <nav className="navbar">
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Logo />
            <span className="font-display" style={{ fontSize: '18px', color: 'var(--cream-800)', letterSpacing: '-0.2px' }}>Assignly</span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* User pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', borderRadius: '999px', padding: '6px 14px 6px 6px' }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--cream-300)' }} />
              ) : (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor(userName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {initials(userName)}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warm-text)', lineHeight: 1 }}>{userName}</span>
                <span style={{ fontSize: '10px', color: 'var(--muted-text)', lineHeight: 1.4 }}>{userProfile?.email}</span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleSignOut}
              className="btn-ghost"
              style={{ gap: '6px', padding: '8px 14px', fontSize: '13px' }}
            >
              <LogOutIcon />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content ─────────────────────────── */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative', zIndex: 1 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="font-display" style={{ fontSize: '30px', color: 'var(--cream-900)', letterSpacing: '-0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Good day, {userName.split(' ')[0]} <Sparkles size={18} style={{ stroke: 'var(--cream-500)', fill: 'var(--cream-200)' }} />
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)' }}>Here's what your team is working on right now.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="btn-ghost"
              style={{ gap: '8px', border: '1px solid var(--cream-300)', padding: '10px 18px', display: 'flex', alignItems: 'center' }}
            >
              <Users size={16} />
              <span>Add Teammate</span>
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-primary"
              style={{ gap: '8px' }}
            >
              <PlusIcon />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Total Tasks', value: total, icon: <FolderKanban size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--cream-200)' },
            { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: <Zap size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--sky-light)' },
            { label: 'Completed', value: done, icon: <CheckCircle2 size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--sage-light)' },
            { label: 'Team Members', value: users.length, icon: <Users size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--amber-light)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                <div style={{ width: '32px', height: '32px', background: s.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warm-text)', letterSpacing: '-0.5px', lineHeight: 1, fontFamily: 'DM Serif Display, serif' }}>
                {loadingTasks ? '—' : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Progress bar ── */}
        <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mid-text)' }}>Overall Progress</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cream-700)' }}>{pct}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--cream-200)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--cream-500), var(--sage-mid))', borderRadius: '999px', transition: 'width 0.6s ease' }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <MailIcon />
            <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Email alerts active</span>
          </div>
        </div>

        {/* ── Filter toolbar ── */}
        <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><SearchIcon /></div>
            <input
              type="text"
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-cream"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          {/* Scope */}
          <select
            value={scopeFilter}
            onChange={e => setScopeFilter(e.target.value)}
            className="input-cream"
            style={{ width: 'auto', paddingRight: '32px', cursor: 'pointer' }}
          >
            <option value="all">All Tasks</option>
            <option value="mine">Assigned to Me</option>
            <option value="created">Created by Me</option>
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="input-cream"
            style={{ width: 'auto', paddingRight: '32px', cursor: 'pointer' }}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <span style={{ fontSize: '12px', color: 'var(--muted-text)', marginLeft: 'auto' }}>
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Kanban Board ── */}
        {loadingTasks ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '14px', flexDirection: 'column' }}>
            <div className="spinner" style={{ width: '28px', height: '28px' }}></div>
            <span style={{ color: 'var(--muted-text)', fontSize: '14px' }}>Loading tasks…</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'start' }}>
            {COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.id)
              return (
                <div key={col.id} className="kanban-col" style={{ background: col.color + '55' }}>
                  {/* Column header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.dot, flexShrink: 0, display: 'block' }}></span>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warm-text)', flex: 1 }}>{col.label}</h3>
                    <span style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid var(--cream-300)', borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)' }}>{colTasks.length}</span>
                  </div>

                  {/* Empty state */}
                  {colTasks.length === 0 && (
                    <div style={{ border: '1.5px dashed var(--cream-400)', borderRadius: '14px', padding: '28px 16px', textAlign: 'center', color: 'var(--muted-text)', fontSize: '13px', marginTop: '8px' }}>
                      {col.emptyMsg}
                    </div>
                  )}

                  {/* Cards */}
                  {colTasks.map(task => (
                    <div key={task.id} className="task-card animate-fade-in">
                      {/* Priority + Status + Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <select
                            value={task.status}
                            onChange={e => handleStatusChange(task.id, e.target.value)}
                            style={{ fontSize: '11px', background: 'var(--sand-100)', border: '1px solid var(--cream-300)', borderRadius: '8px', padding: '4px 8px', color: 'var(--mid-text)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Done ✓</option>
                          </select>
                          {task.created_by === userProfile?.id && (
                            <button
                              onClick={() => handleDelete(task)}
                              title="Delete task"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-text)', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--rose-dark)'}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-text)'}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: task.status === 'completed' ? 'var(--muted-text)' : 'var(--warm-text)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        marginBottom: '6px',
                        lineHeight: 1.4,
                      }}>
                        {task.title}
                      </h4>

                      {/* Description */}
                      {task.description && (
                        <p style={{ fontSize: '12px', color: 'var(--muted-text)', lineHeight: 1.5, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {task.description}
                        </p>
                      )}

                      {/* Footer: date + assignee */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--cream-200)', paddingTop: '10px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CalIcon />
                          <span style={{ fontSize: '11px', color: 'var(--muted-text)' }}>
                            {fmtDate(task.due_date) ?? 'No date'}
                          </span>
                        </div>

                        {/* Assignee Select Dropdown */}
                        <select
                          value={task.assigned_to || ''}
                          onChange={e => handleAssigneeChange(task.id, e.target.value)}
                          style={{
                            fontSize: '11px',
                            background: 'var(--sand-100)',
                            border: '1px solid var(--cream-300)',
                            borderRadius: '999px',
                            padding: '3px 8px 3px 6px',
                            color: 'var(--mid-text)',
                            cursor: 'pointer',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 500,
                            maxWidth: '120px',
                            outline: 'none',
                          }}
                        >
                          <option value="">Unassigned</option>
                          {users.filter(u => u.id !== userProfile?.id).map(u => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Create Task Modal ─────────────────────── */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsCreateOpen(false) }}>
          <div className="modal-box">
            {/* Modal header */}
            <div style={{ background: 'var(--sand-100)', borderBottom: '1px solid var(--cream-300)', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: '20px', color: 'var(--cream-900)', letterSpacing: '-0.2px', marginBottom: '2px' }}>Create New Task</h2>
                <p style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Assignee will receive a Gmail notification instantly.</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '13px' }}>
                Cancel
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreate} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Title */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Review landing page design…"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input-cream"
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Add context, links, or bullet points…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input-cream"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Priority + Due date row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }} />
                </div>
              </div>

              {/* Assign to */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Assign to
                </label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }}>
                  <option value="">— Unassigned —</option>
                  {users.filter(u => u.id !== userProfile?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
                <p style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={11} style={{ stroke: 'var(--cream-500)' }} /> A Gmail notification will be sent to the assignee automatically.
                </p>
              </div>

              {/* Submit */}
              <button type="submit" disabled={actionLoading} className="btn-primary" style={{ marginTop: '4px' }}>
                {actionLoading ? <><Loader2 size={16} className="animate-spin" /><span>Creating…</span></> : <><PlusIcon /><span>Create Task & Notify</span></>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Invite Teammate Modal ─────────────────── */}
      {isInviteOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsInviteOpen(false) }}>
          <div className="modal-box">
            {/* Modal header */}
            <div style={{ background: 'var(--sand-100)', borderBottom: '1px solid var(--cream-300)', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: '20px', color: 'var(--cream-900)', letterSpacing: '-0.2px', marginBottom: '2px' }}>Add Team Member</h2>
                <p style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Register a teammate so you can assign them tasks instantly.</p>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '13px' }}>
                Cancel
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleInvite} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Full Name */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Yash Vardhan…"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  className="input-cream"
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yash@example.com…"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="input-cream"
                />
                <p style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={11} style={{ stroke: 'var(--cream-500)' }} /> Teammate will show up in the "Assign to" dropdown instantly.
                </p>
              </div>

              {/* Submit */}
              <button type="submit" disabled={actionLoading} className="btn-primary" style={{ marginTop: '4px' }}>
                {actionLoading ? <><Loader2 size={16} className="animate-spin" /><span>Adding…</span></> : <span>Add Teammate</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '20px 28px', borderTop: '1px solid var(--cream-300)', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '11px', color: 'var(--muted-text)' }}>© 2026 Assignly — Powered by Next.js, Flask & Supabase</p>
      </footer>
    </div>
  )
}
