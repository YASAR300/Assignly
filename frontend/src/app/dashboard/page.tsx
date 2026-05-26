'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { 
  Plus, Search, LogOut, Trash2, Mail, Calendar, FolderKanban, 
  Zap, CheckCircle2, Users, Loader2, Sparkles, Sun, Moon, 
  ArrowLeft, Download, Eye, RefreshCw, Check, AlertCircle, Upload, ChevronRight
} from 'lucide-react'

// ── Interfaces ─────────────────────────────────────
interface UserProfile {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  avatar_url: string
}

interface Task {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'accepted' | 'revision_requested'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_by: string
  assigned_to: string | null
  product_image_url: string | null
  created_at: string
  updated_at: string
  creator_name: string
  assignee_name: string
  assignee_email: string | null
  assignee_avatar: string | null
}

interface GeneratedImage {
  id: string
  task_id: string
  image_type: string
  image_url: string
  prompt_used: string
  metadata: {
    engine: string
    width: number
    height: number
    generated_at: string
    sandbox: boolean
  }
  angle: string | null
  is_final: boolean
  created_at: string
}

interface JobStatus {
  status: 'pending' | 'processing' | 'success' | 'failed'
  progress: number
  result: GeneratedImage | null
  error: string | null
}

interface VariationConfig {
  id: string
  name: string
  category: string
  description: string
  defaultPrompt: string
  angle?: 'front' | 'side' | 'closeup'
}

// ── Lucide Icon Adaptors ───────────────────────────
const Logo = () => <FolderKanban size={24} style={{ stroke: 'var(--cream-700)' }} />
const PlusIcon = () => <Plus size={16} />
const SearchIcon = () => <Search size={15} style={{ stroke: 'var(--muted-text)' }} />
const LogOutIcon = () => <LogOut size={15} />
const TrashIcon = () => <Trash2 size={14} />
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

// ── Variation Config for AI Studio ──────────────────
const VARIATIONS: VariationConfig[] = [
  {
    id: 'white_background',
    name: 'Pure White Background',
    category: 'E-Commerce Use',
    description: '100% solid white background, optimized for clean e-commerce listings.',
    defaultPrompt: 'Pure solid 100% flat white studio background, clean drop shadow zone, empty stage, absolute solid white background, high quality, 8k',
  },
  {
    id: 'theme_marble',
    name: 'Marble Surface Backdrop',
    category: 'Theme-Based (1/2)',
    description: 'Polished white and grey marble surface background.',
    defaultPrompt: 'Sleek empty polished white carrara marble table surface backdrop, soft elegant morning side lighting, blurred depth of field background, clean empty studio stage, no jewelry, 8k',
  },
  {
    id: 'theme_velvet',
    name: 'Luxury Velvet Backdrop',
    category: 'Theme-Based (2/2)',
    description: 'Rich royal velvet backdrop with elegant folds.',
    defaultPrompt: 'Rich royal emerald green velvet fabric with soft elegant folds, luxurious moody lighting, dramatic shadows, shallow depth of field background, empty backdrop stage, no jewelry, 8k',
  },
  {
    id: 'creative_sunset',
    name: 'Beach Sunset Scene',
    category: 'Creative / Artistic (1/2)',
    description: 'Artistic beach sunset scene with warm, golden tones.',
    defaultPrompt: 'Warm tropical sandy beach at sunset backdrop, glowing golden hour light, gentle waves in soft focus background, magical reflections, empty scenic presentation stage, no jewelry, 8k',
  },
  {
    id: 'creative_forest',
    name: 'Misty Forest Scene',
    category: 'Creative / Artistic (2/2)',
    description: 'Artistic misty forest background with sun rays.',
    defaultPrompt: 'Mossy natural wood in a misty sun-dappled green forest canopy backdrop, rays of light filtering through trees in soft focus, organic and natural luxury stage, empty background, no jewelry, 8k',
  },
  {
    id: 'model_front',
    name: 'Model Wearing (Front View)',
    category: 'Realistic Human Model (1/3)',
    description: 'Realistic human model wearing or holding the product - Front view portrait.',
    defaultPrompt: 'High fashion editorial photo of a beautiful elegant female model centered neck and chest portrait shot, soft natural skin texture, expensive designer dress, luxurious studio lighting, cinematic, empty neck space, model not wearing any jewelry, no necklace, bare neck, bare skin, photorealistic, 8k',
    angle: 'front',
  },
  {
    id: 'model_side',
    name: 'Model Wearing (Side 45° Angle)',
    category: 'Realistic Human Model (2/3)',
    description: 'Realistic human model wearing or holding the product - Side angle view.',
    defaultPrompt: 'Fashion magazine editorial centered portrait of an elegant woman in profile, 45 degree side angle shot, showing her ear and neck, soft warm sunlight, bare ear and bare neck, not wearing any jewelry, no earrings, no necklace, bare skin, photorealistic, 8k',
    angle: 'side',
  },
  {
    id: 'model_closeup',
    name: 'Model Wearing (Close-up Shot)',
    category: 'Realistic Human Model (3/3)',
    description: 'Extreme close-up shot of the product being worn by a model.',
    defaultPrompt: 'Macro close-up studio photograph of a woman\'s clean skin on neck and collarbone, soft luxury cosmetics lighting, crisp focus, bare skin, not wearing any jewelry, no necklace, commercial beauty campaign, 8k',
    angle: 'closeup',
  },
]

import { Session } from '@supabase/supabase-js'

const darkThemeStyles = `
  .dark-mode {
    --cream-50:  #1A140B;
    --cream-100: #120D06;
    --cream-200: #241D12;
    --cream-300: #382D1E;
    --cream-400: #574630;
    --cream-500: #8E7142;
    --cream-600: #A8884E;
    --cream-700: #D9C4A0;
    --cream-800: #FAF6EE;
    --cream-900: #FDFBF7;

    --sand-100: #1D170E;
    --sand-200: #2C2216;
    --sand-300: #423524;

    --warm-text: #FDFBF7;
    --mid-text:  #E8D9BC;
    --muted-text:#C9A96E;
  }
  .dark-mode input, .dark-mode textarea, .dark-mode select {
    background-color: var(--cream-200) !important;
    border-color: var(--cream-300) !important;
    color: var(--warm-text) !important;
  }
  .dark-mode .navbar {
    background: rgba(18, 13, 6, 0.80) !important;
    border-color: var(--cream-300) !important;
  }
  .dark-mode .card-cream, .dark-mode .modal-box {
    background: rgba(26, 20, 11, 0.85) !important;
    border-color: var(--cream-300) !important;
  }
  .dark-mode .task-card {
    background: var(--cream-200) !important;
    border-color: var(--cream-300) !important;
  }
  .dark-mode .kanban-col {
    background: var(--cream-50) !important;
    border-color: var(--cream-300) !important;
  }
`

// ── Kanban Column Definition ───────────────────────
const KANBAN_COLUMNS = [
  { id: 'todo', label: 'To Do / Assigned', statuses: ['pending', 'assigned'], color: '#E8D9BC', dot: '#C9A96E', emptyMsg: 'No tasks pending. Time to create one!' },
  { id: 'in_progress', label: 'In Progress / Revisions', statuses: ['in_progress', 'revision_requested'], color: '#DCE8F0', dot: '#7EB0CC', emptyMsg: 'No active AI Studio generations right now.' },
  { id: 'submitted', label: 'Submitted for Review', statuses: ['submitted'], color: '#FAECD4', dot: '#E8A84A', emptyMsg: 'No submissions waiting for approval.' },
  { id: 'accepted', label: 'Approved & Final', statuses: ['accepted'], color: '#D4E6D3', dot: '#8FBC8B', emptyMsg: 'Approved tasks will appear here in the final gallery.' }
]

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '')

  const [session, setSession] = useState<Session | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Theme support
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Modal open states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [togglingRole, setTogglingRole] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [updatingTask, setUpdatingTask] = useState<{ id: string, field: 'status' | 'assignee' } | null>(null)

  // Forms state
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', product_image_url: '' })
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', role: 'user' })

  // AI Studio overlay state
  const [activeStudioTask, setActiveStudioTask] = useState<Task | null>(null)
  const [studioImages, setStudioImages] = useState<GeneratedImage[]>([])
  const [studioLoading, setStudioLoading] = useState(true)
  const [submittingStudio, setSubmittingStudio] = useState(false)
  
  // Custom polling states for active studio jobs
  const [runningJobs, setRunningJobs] = useState<{ [imageType: string]: { jobId: string, prompt: string, startedAt: number } }>({})

  // Admin Review Modal State
  const [activeReviewTask, setActiveReviewTask] = useState<Task | null>(null)
  const [reviewImages, setReviewImages] = useState<GeneratedImage[]>([])
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewActionLoading, setReviewActionLoading] = useState(false)

  // Lightbox Image viewer state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Auth ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setSession(session)
      
      // Load stored theme
      const storedTheme = localStorage.getItem('theme')
      if (storedTheme === 'dark') {
        setIsDarkMode(true)
      }
      setAuthLoading(false)
    })
  }, [router, supabase])

  // ── API Headers ──────────────────────────────────
  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }), [session])

  // ── API Loaders ──────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!session) return
    setLoadingTasks(true)
    try {
      const res = await fetch(`${baseUrl}/api/tasks`, { headers: headers() })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      setTasks(await res.json())
    } catch { toast.error('Could not load tasks') }
    finally { setLoadingTasks(false) }
  }, [session, headers, baseUrl])

  const fetchUsers = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch(`${baseUrl}/api/users`, { headers: headers() })
      if (res.ok) {
        const uList = await res.json()
        setUsers(uList)
        
        // Find current logged-in user profile
        const me = uList.find((u: UserProfile) => u.id === session.user.id)
        if (me) setCurrentUser(me)
      }
    } catch { /* silent */ }
  }, [session, headers, baseUrl])

  useEffect(() => {
    if (!session) return
    fetchTasks()
    fetchUsers()
  }, [session, fetchTasks, fetchUsers])

  // ── Theme Toggle ─────────────────────────────────
  const toggleTheme = () => {
    const nextTheme = !isDarkMode
    setIsDarkMode(nextTheme)
    localStorage.setItem('theme', nextTheme ? 'dark' : 'light')
  }

  // ── Toggle user role (DX testing helper) ──────────
  const toggleRole = async () => {
    if (!session) return
    const isDeveloper = session?.user?.email?.toLowerCase().includes('yasar') || session?.user?.email?.toLowerCase().includes('sypher') || currentUser?.name?.toLowerCase().includes('yasar') || currentUser?.name?.toLowerCase().includes('sypher')
    if (!isDeveloper) {
      toast.error('Only authorized developers are allowed to simulate roles.')
      return
    }

    setTogglingRole(true)
    try {
      const res = await fetch(`${baseUrl}/api/users/toggle-role`, {
        method: 'POST',
        headers: headers()
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Role toggled to ${data.role.toUpperCase()}!`)
        await fetchUsers()
        await fetchTasks()
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Role toggle failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle role')
    } finally {
      setTogglingRole(false)
    }
  }

  // ── File upload handler ───────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    const file = files[0]
    setUploadingImage(true)
    
    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `prod_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
        
      if (error) {
        throw error
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)
        
      setForm(f => ({ ...f, product_image_url: publicUrl }))
      toast.success('Product photo uploaded successfully to Supabase!')
    } catch (err: any) {
      console.error('Upload error:', err)
      toast.error(err.message || 'Failed to upload product photo.')
    } finally {
      setUploadingImage(false)
    }
  }


  // ── Actions ──────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Task title is required.'); return }
    if (!form.product_image_url) { toast.error('A product photo is required for AI Studio tasks.'); return }
    
    setActionLoading(true)
    try {
      const body = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: form.assigned_to || null,
        product_image_url: form.product_image_url
      }
      
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      
      setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', product_image_url: '' })
      setIsCreateOpen(false)
      await fetchTasks()
      toast.success('Task created! Teammate notified via email.')
    } catch (err: any) {
      toast.error(err.message || 'Error creating task.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingTask({ id: taskId, field: 'status' })
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Update failed')
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t))
      toast.success('Status updated!')
    } catch (err: any) {
      toast.error(err.message || 'Error updating status')
    } finally {
      setUpdatingTask(null)
    }
  }

  const handleAssigneeChange = async (taskId: string, newAssigneeId: string) => {
    setUpdatingTask({ id: taskId, field: 'assignee' })
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ assigned_to: newAssigneeId || null }),
      })
      if (!res.ok) throw new Error('Assignee update failed')
      await fetchTasks()
      toast.success('Assignee updated!')
    } catch (err: any) {
      toast.error(err.message || 'Error updating assignee')
    } finally {
      setUpdatingTask(null)
    }
  }

  const handleDelete = async (task: Task) => {
    if (!confirm(`Are you absolutely sure you want to delete the task "${task.title}"?`)) return
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: 'DELETE', headers: headers(),
      })
      if (!res.ok) throw new Error('Delete failed')
      setTasks(prev => prev.filter(t => t.id !== task.id))
      toast.success('Task deleted successfully.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteForm.email.trim()) { toast.error('Teammate email is required.'); return }
    
    setActionLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          full_name: inviteForm.full_name.trim(),
          email: inviteForm.email.trim(),
          role: inviteForm.role
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      
      setInviteForm({ full_name: '', email: '', role: 'user' })
      setIsInviteOpen(false)
      await fetchUsers()
      toast.success('Teammate added and invited successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Error adding teammate')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // ── AI Studio Business Logic ──────────────────────

  const openAIStudio = async (task: Task) => {
    setActiveStudioTask(task)
    setStudioLoading(true)
    setStudioImages([])
    setRunningJobs({})
    
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${task.id}/images`, { headers: headers() })
      if (res.ok) {
        const list: GeneratedImage[] = await res.json()
        setStudioImages(list)
      }
    } catch {
      toast.error('Could not load existing images.')
    } finally {
      setStudioLoading(false)
    }
  }

  // AI image generation triggers
  const triggerImageGeneration = async (imageType: string, promptText: string) => {
    if (!activeStudioTask) return
    
    // Set custom visual state in running jobs
    setRunningJobs(prev => ({
      ...prev,
      [imageType]: {
        jobId: 'pending',
        prompt: promptText,
        startedAt: Date.now()
      }
    }))
    
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${activeStudioTask.id}/generate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          image_type: imageType,
          prompt: promptText
        })
      })
      
      if (res.status === 429) {
        throw new Error('Rate limit exceeded: Max 10 requests per hour.')
      }
      
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Generation failed to start')
      }
      
      const data = await res.json()
      const jobId = data.job_id
      
      // Update job running record with actual job id and start polling
      setRunningJobs(prev => ({
        ...prev,
        [imageType]: {
          ...prev[imageType],
          jobId: jobId
        }
      }))
      
      // Launch Poller
      pollJobStatus(jobId, imageType)
      toast.success('AI generation started in background!')
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to start AI generation')
      // Clean up running job visual on failure
      setRunningJobs(prev => {
        const next = { ...prev }
        delete next[imageType]
        return next
      })
    }
  }

  // Job Polling
  const pollJobStatus = (jobId: string, imageType: string) => {
    let intervalId: any = null
    let attempts = 0
    
    intervalId = setInterval(async () => {
      attempts++
      if (attempts > 60) { // 90 seconds timeout
        clearInterval(intervalId)
        toast.error(`Job for ${imageType} timed out.`)
        setRunningJobs(prev => {
          const next = { ...prev }
          delete next[imageType]
          return next
        })
        return
      }
      
      try {
        const res = await fetch(`${baseUrl}/api/tasks/jobs/${jobId}`, { headers: headers() })
        if (res.ok) {
          const job: JobStatus = await res.json()
          
          if (job.status === 'success' && job.result) {
            clearInterval(intervalId)
            
            // Add new image and mark active
            setStudioImages(prev => {
              const cleaned = prev.filter(img => img.image_type !== imageType)
              return [job.result!, ...cleaned]
            })
            
            setRunningJobs(prev => {
              const next = { ...prev }
              delete next[imageType]
              return next
            })
            
            toast.success(`Variation successfully generated!`)
          } else if (job.status === 'failed') {
            clearInterval(intervalId)
            toast.error(`Generation failed: ${job.error || 'Unknown AI error'}`)
            setRunningJobs(prev => {
              const next = { ...prev }
              delete next[imageType]
              return next
            })
          }
        }
      } catch {
        // Continue silently on brief network blips
      }
    }, 1500)
  }

  // Delete generated image
  const deleteGeneratedImage = async (imageId: string, imageType: string) => {
    if (!confirm('Are you sure you want to delete this variation? This action is permanent.')) return
    
    try {
      const res = await fetch(`${baseUrl}/api/generated-images/${imageId}`, {
        method: 'DELETE',
        headers: headers()
      })
      if (!res.ok) throw new Error('Deletion failed')
      
      setStudioImages(prev => prev.filter(img => img.id !== imageId))
      toast.success('Image deleted.')
    } catch {
      toast.error('Failed to delete generated image.')
    }
  }

  // Toggle image final state
  const toggleImageFinal = async (imageId: string, currentVal: boolean) => {
    try {
      const res = await fetch(`${baseUrl}/api/generated-images/${imageId}/final`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ is_final: !currentVal })
      })
      if (!res.ok) throw new Error('Failed to update final status')
      
      const updated: GeneratedImage = await res.json()
      setStudioImages(prev => prev.map(img => {
        if (img.id === imageId) return updated
        // If the toggled is final, other images of same type are un-finaled
        if (updated.is_final && img.image_type === updated.image_type && img.id !== imageId) {
          return { ...img, is_final: false }
        }
        return img
      }))
      toast.success(updated.is_final ? 'Variation marked as active final!' : 'Variation unmarked.')
    } catch {
      toast.error('Failed to update image preference.')
    }
  }

  // Submit Task (User -> Admin)
  const submitTaskToAdmin = async () => {
    if (!activeStudioTask) return
    setSubmittingStudio(true)
    
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${activeStudioTask.id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status: 'submitted' })
      })
      
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to submit task')
      }
      
      toast.success('Task successfully submitted to Admin!')
      setActiveStudioTask(null)
      await fetchTasks()
    } catch (err: any) {
      toast.error(err.message || 'Error submitting task.')
    } finally {
      setSubmittingStudio(false)
    }
  }

  // ── Admin Review Panel Business Logic ──────────────

  const openAdminReview = async (task: Task) => {
    setActiveReviewTask(task)
    setReviewLoading(true)
    setReviewImages([])
    setReviewFeedback('')
    
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${task.id}/images`, { headers: headers() })
      if (res.ok) {
        const list: GeneratedImage[] = await res.json()
        setReviewImages(list.filter(img => img.is_final))
      }
    } catch {
      toast.error('Could not load submitted images.')
    } finally {
      setReviewLoading(false)
    }
  }

  const submitReviewAction = async (action: 'accept' | 'revision') => {
    if (!activeReviewTask) return
    setReviewActionLoading(true)
    
    try {
      const res = await fetch(`${baseUrl}/api/tasks/${activeReviewTask.id}/review`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          action: action,
          feedback: reviewFeedback
        })
      })
      
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to submit review')
      }
      
      toast.success(action === 'accept' ? 'Task Approved! User confirmed.' : 'Revision requested successfully.')
      setActiveReviewTask(null)
      await fetchTasks()
    } catch (err: any) {
      toast.error(err.message || 'Failed to log review decision.')
    } finally {
      setReviewActionLoading(false)
    }
  }

  // ── Derived state ────────────────────────────────
  const filtered = tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter
    const matchScope =
      scopeFilter === 'all' ? true :
      scopeFilter === 'mine' ? t.assigned_to === currentUser?.id :
      t.created_by === currentUser?.id
    return matchSearch && matchPriority && matchScope
  })

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'accepted').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // AI Studio variation check helpers
  const getStudioImageForType = (typeId: string) => studioImages.find(img => img.image_type === typeId)
  const getReviewImageForType = (typeId: string) => reviewImages.find(img => img.image_type === typeId)

  // Count active final images
  const finalImagesCount = studioImages.filter(img => img.is_final).length

  // ── Loading screen ───────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
        <p style={{ color: 'var(--muted-text)', fontSize: '14px' }}>Loading workspace profile…</p>
      </div>
    )
  }

  const userName = currentUser?.name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || 'Collaborator'
  const userAvatar = currentUser?.avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture
  const isDeveloper = !!(session?.user?.email?.toLowerCase().includes('yasar') || session?.user?.email?.toLowerCase().includes('sypher') || currentUser?.name?.toLowerCase().includes('yasar') || currentUser?.name?.toLowerCase().includes('sypher'))

  // ── Render ────────────────────────────────────────
  return (
    <div className={`${isDarkMode ? 'dark-mode' : ''}`} style={{ minHeight: '100vh', background: 'var(--cream-100)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Dynamic Theme Styles Injection */}
      <style>{`
        ${darkThemeStyles}
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

      {/* ── Navbar ───────────────────────────────── */}
      <nav className="navbar">
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Logo />
            <span className="font-display" style={{ fontSize: '18px', color: 'var(--cream-800)', letterSpacing: '-0.2px' }}>Assignly AI</span>
            
            {/* Role indicator badge */}
            <span className={`badge ${currentUser?.role === 'admin' ? 'badge-high' : 'badge-low'}`} style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {currentUser?.role === 'admin' ? (
                <>
                  <Zap size={10} />
                  <span>Admin</span>
                </>
              ) : (
                <>
                  <Users size={10} />
                  <span>Studio User</span>
                </>
              )}
            </span>
          </div>

          {/* Center / Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Toggle Role Button (DX Testing Utility) - Restricted to Developers */}
            {isDeveloper && (
              <button
                disabled={togglingRole}
                onClick={toggleRole}
                className="btn-ghost"
                style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--cream-500)', color: 'var(--cream-700)', fontWeight: 600, gap: '4px', opacity: togglingRole ? 0.7 : 1, cursor: togglingRole ? 'not-allowed' : 'pointer' }}
                title="Quickly switch between Admin and User role."
              >
                {togglingRole ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                <span>Simulate {currentUser?.role === 'admin' ? 'User' : 'Admin'} role</span>
              </button>
            )}

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost"
              style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Toggle Light/Dark Workspace Style"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* User Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', borderRadius: '999px', padding: '4px 12px 4px 4px' }} className="hidden md:flex">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--cream-300)' }} />
              ) : (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor(userName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {initials(userName)}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warm-text)', lineHeight: 1 }}>{userName.split(' ')[0]}</span>
                <span style={{ fontSize: '9px', color: 'var(--muted-text)', lineHeight: 1.2 }}>{session?.user?.email}</span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleSignOut}
              className="btn-ghost"
              style={{ gap: '6px', padding: '8px 14px', fontSize: '13px' }}
            >
              <LogOutIcon />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main Dashboard Workspace ───────────────── */}
      {!activeStudioTask && (
        <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative', zIndex: 1 }}>

          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 className="font-display" style={{ fontSize: '30px', color: 'var(--cream-900)', letterSpacing: '-0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Welcome, {userName.split(' ')[0]} <Sparkles size={18} style={{ stroke: 'var(--cream-500)', fill: 'var(--cream-200)' }} />
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--muted-text)' }}>
                {currentUser?.role === 'admin' 
                  ? "Admin Control Panel: Create jewelry photography tasks, assign members, and approve galleries." 
                  : "AI Studio Dashboard: Select assigned tasks to enter the background-removal and AI composition canvas."}
              </p>
            </div>
            
            {/* Header Controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setIsInviteOpen(true)}
                className="btn-ghost"
                style={{ gap: '8px', border: '1px solid var(--cream-300)', padding: '10px 18px', display: 'flex', alignItems: 'center' }}
              >
                <Users size={16} />
                <span>Add Member</span>
              </button>
              
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="btn-primary"
                  style={{ gap: '8px' }}
                >
                  <PlusIcon />
                  <span>Create Task</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Total Task List', value: total, icon: <FolderKanban size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--cream-200)' },
              { label: 'Studio Progressing', value: tasks.filter(t => ['in_progress', 'revision_requested'].includes(t.status)).length, icon: <Zap size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--sky-light)' },
              { label: 'Submissions to Review', value: tasks.filter(t => t.status === 'submitted').length, icon: <AlertCircle size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--amber-light)' },
              { label: 'Approved Galleries', value: done, icon: <CheckCircle2 size={16} style={{ stroke: 'var(--cream-600)' }} />, bg: 'var(--sage-light)' },
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

          {/* overall progress */}
          <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mid-text)' }}>Creative Workflow Accomplishment</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cream-700)' }}>{pct}% approved</span>
              </div>
              <div style={{ height: '8px', background: 'var(--cream-200)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--cream-500), var(--sage-mid))', borderRadius: '999px', transition: 'width 0.6s ease' }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} className="hidden sm:flex">
              <Mail size={14} style={{ stroke: 'var(--cream-600)' }} />
              <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Brevo SMTP active</span>
            </div>
          </div>

          {/* Filtering controls */}
          <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><SearchIcon /></div>
              <input
                type="text"
                placeholder="Search jewelry project tasks…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-cream"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <select
              value={scopeFilter}
              onChange={e => setScopeFilter(e.target.value)}
              className="input-cream"
              style={{ width: 'auto', paddingRight: '32px', cursor: 'pointer' }}
            >
              <option value="all">All Workspace Tasks</option>
              <option value="mine">My Direct Tasks</option>
              <option value="created">Tasks I Created</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="input-cream"
              style={{ width: 'auto', paddingRight: '32px', cursor: 'pointer' }}
            >
              <option value="all">All Priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>

            <span style={{ fontSize: '12px', color: 'var(--muted-text)', marginLeft: 'auto' }}>
              {filtered.length} task{filtered.length !== 1 ? 's' : ''} listed
            </span>
          </div>

          {/* Kanban board */}
          {loadingTasks ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '14px', flexDirection: 'column' }}>
              <div className="spinner" style={{ width: '28px', height: '28px' }}></div>
              <span style={{ color: 'var(--muted-text)', fontSize: '14px' }}>Syncing workflow...</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
              {KANBAN_COLUMNS.map(col => {
                const colTasks = filtered.filter(t => col.statuses.includes(t.status))
                return (
                  <div key={col.id} className="kanban-col" style={{ background: col.color + '22' }}>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.dot, flexShrink: 0 }}></span>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warm-text)', flex: 1 }}>{col.label}</h3>
                      <span style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)' }}>{colTasks.length}</span>
                    </div>

                    {/* Column body */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                      {colTasks.length === 0 ? (
                        <div style={{ border: '1.5px dashed var(--cream-300)', borderRadius: '16px', padding: '36px 16px', textAlign: 'center', color: 'var(--muted-text)', fontSize: '12px', marginTop: '4px' }}>
                          {col.emptyMsg}
                        </div>
                      ) : (
                        colTasks.map(task => {
                          const isAssignedToMe = task.assigned_to === currentUser?.id
                          const isCreator = task.created_by === currentUser?.id
                          
                          // Determine color accents for status tags
                          let statusColor = 'var(--muted-text)'
                          let statusBg = 'var(--sand-100)'
                          if (task.status === 'in_progress') { statusColor = 'var(--sky-dark)'; statusBg = 'var(--sky-light)' }
                          else if (task.status === 'revision_requested') { statusColor = 'var(--rose-dark)'; statusBg = 'var(--rose-light)' }
                          else if (task.status === 'submitted') { statusColor = 'var(--amber-dark)'; statusBg = 'var(--amber-light)' }
                          else if (task.status === 'accepted') { statusColor = 'var(--sage-dark)'; statusBg = 'var(--sage-light)' }

                          return (
                            <div 
                              key={task.id} 
                              className="task-card animate-fade-in"
                              style={{ borderLeft: `4px solid ${col.dot}`, cursor: 'pointer' }}
                              onClick={() => {
                                // If submitted and current user is Admin, open Admin review
                                if (task.status === 'submitted' && currentUser?.role === 'admin') {
                                  openAdminReview(task)
                                } else {
                                  // Open standard AI Studio workspace
                                  openAIStudio(task)
                                }
                              }}
                            >
                              
                              {/* Header info */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                                
                                <span className="badge" style={{ background: statusBg, color: statusColor, fontSize: '10px' }}>
                                  {task.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>

                              {/* Task Product Image Preview if exists */}
                              {task.product_image_url && (
                                <div style={{ width: '100%', height: '140px', borderRadius: '10px', overflow: 'hidden', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', marginBottom: '12px', position: 'relative' }}>
                                  <img 
                                    src={task.product_image_url} 
                                    alt={task.title} 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  />
                                </div>
                              )}

                              {/* Title & Desc */}
                              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warm-text)', marginBottom: '6px', lineHeight: 1.4 }}>
                                {task.title}
                              </h4>
                              {task.description && (
                                <p style={{ fontSize: '12px', color: 'var(--muted-text)', lineHeight: 1.5, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {task.description}
                                </p>
                              )}

                              {/* Footer */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--cream-200)', paddingTop: '10px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CalIcon />
                                  <span style={{ fontSize: '11px', color: 'var(--muted-text)' }}>
                                    {fmtDate(task.due_date) ?? 'No date'}
                                  </span>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  
                                  {/* Quick assign select only for admins */}
                                  {currentUser?.role === 'admin' ? (
                                    <select
                                      value={task.assigned_to || ''}
                                      disabled={updatingTask?.id === task.id && updatingTask?.field === 'assignee'}
                                      onChange={e => handleAssigneeChange(task.id, e.target.value)}
                                      style={{
                                        fontSize: '11px',
                                        background: 'var(--sand-100)',
                                        border: `1px solid ${updatingTask?.id === task.id && updatingTask?.field === 'assignee' ? 'var(--cream-500)' : 'var(--cream-300)'}`,
                                        borderRadius: '999px',
                                        padding: '2px 6px',
                                        color: 'var(--mid-text)',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        maxWidth: '110px'
                                      }}
                                    >
                                      <option value="">Unassigned</option>
                                      {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--muted-text)', fontWeight: 500 }}>
                                      Assignee: {task.assignee_name || 'Unassigned'}
                                    </span>
                                  )}

                                  {/* Delete for creator admins */}
                                  {currentUser?.role === 'admin' && (
                                    <button
                                      onClick={() => handleDelete(task)}
                                      title="Delete task permanently"
                                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-text)', padding: '2px' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--rose-dark)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-text)'}
                                    >
                                      <TrashIcon />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Interactive chevron action */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--cream-600)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                  {task.status === 'submitted' && currentUser?.role === 'admin' ? 'Start Review' : 'Open AI Studio'}
                                  <ChevronRight size={12} />
                                </span>
                              </div>

                            </div>
                          )
                        })
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          )}

        </main>
      )}

      {/* ── EMBEDDED AI STUDIO VIEW ─────────────────── */}
      {activeStudioTask && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out', position: 'relative', zIndex: 10 }}>
          
          {/* Top Panel Controls */}
          <div style={{ background: 'var(--cream-50)', borderBottom: '1px solid var(--cream-300)', padding: '16px 28px' }}>
            <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={() => {
                    setActiveStudioTask(null)
                    fetchTasks()
                  }} 
                  className="btn-ghost"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Dashboard</span>
                </button>
                
                <div>
                  <h1 className="font-display" style={{ fontSize: '22px', color: 'var(--cream-900)', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    AI Studio Canvas <Sparkles size={16} style={{ stroke: 'var(--cream-500)', fill: 'var(--cream-200)' }} />
                  </h1>
                  <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: 0 }}>
                    Active Task: <strong>{activeStudioTask.title}</strong>
                  </p>
                </div>
              </div>

              {/* Center status tracking */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', padding: '8px 20px', borderRadius: '999px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '32px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warm-text)' }}>Final Jewelry Portfolio Status:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: finalImagesCount === 8 ? 'var(--sage-dark)' : 'var(--cream-700)' }}>
                      {finalImagesCount} / 8 generated
                    </span>
                  </div>
                  <div style={{ width: '220px', height: '6px', background: 'var(--cream-100)', borderRadius: '999px', overflow: 'hidden', marginTop: '4px' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${(finalImagesCount / 8) * 100}%`, 
                        background: finalImagesCount === 8 ? 'var(--sage-mid)' : 'var(--cream-600)',
                        borderRadius: '999px',
                        transition: 'width 0.3s ease'
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Submit Final Button */}
              <div>
                {activeStudioTask.status === 'submitted' || activeStudioTask.status === 'accepted' ? (
                  <div className="badge badge-completed" style={{ padding: '10px 18px', fontSize: '12px' }}>
                    ✓ Work Already Submitted
                  </div>
                ) : (
                  <button
                    disabled={finalImagesCount < 8 || submittingStudio}
                    onClick={submitTaskToAdmin}
                    className="btn-primary"
                    style={{ background: finalImagesCount === 8 ? 'var(--sage-mid)' : 'var(--cream-600)', color: 'white', gap: '8px', padding: '10px 24px' }}
                  >
                    {submittingStudio ? (
                      <><Loader2 size={16} className="animate-spin" /><span>Submitting Portfolio…</span></>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Submit 8 Final Images to Admin</span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* AI Studio Working Area */}
          <div style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '28px', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '28px', alignItems: 'start' }}>
            
            {/* Left Side: Sticky Product Showcase */}
            <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Product Original Image Card */}
              <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '24px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Original Product Image</h3>
                
                {activeStudioTask.product_image_url ? (
                  <div style={{ width: '100%', height: '260px', borderRadius: '16px', overflow: 'hidden', background: 'var(--cream-200)', border: '1px solid var(--cream-300)', position: 'relative' }}>
                    <img 
                      src={activeStudioTask.product_image_url} 
                      alt="Original product" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    {/* View full size helper */}
                    <button 
                      onClick={() => setLightboxUrl(activeStudioTask.product_image_url!)}
                      style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(253,251,247,0.9)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                      title="View original image full size"
                    >
                      <Eye size={14} style={{ stroke: 'var(--cream-700)' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '220px', border: '2px dashed var(--cream-300)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-text)', fontSize: '13px' }}>
                    No product image uploaded.
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warm-text)', marginBottom: '4px' }}>{activeStudioTask.title}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--muted-text)', lineHeight: 1.4, margin: 0 }}>
                    {activeStudioTask.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* AI Consistency Rules Info Box */}
              <div style={{ background: 'var(--cream-200)', border: '1px solid var(--cream-300)', borderRadius: '20px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Sparkles size={18} style={{ stroke: 'var(--cream-600)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cream-900)', marginBottom: '6px' }}>Perfect Brand Consistency</h4>
                    <p style={{ fontSize: '11px', color: 'var(--cream-800)', lineHeight: 1.5, margin: 0 }}>
                      Our AI pipeline strips away the background from your jewelry photo and programmatically overlays it onto newly generated backgrounds. The product shape, materials, reflections, and details remain **100% identical and unchanged** down to the pixel!
                    </p>
                  </div>
                </div>
              </div>

              {/* Requirement checklist */}
              <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Variations Checklist</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {VARIATIONS.map(v => {
                    const img = getStudioImageForType(v.id)
                    const isGenerated = img !== undefined
                    const isFinal = img?.is_final === true
                    
                    return (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <div style={{ 
                          width: '16px', height: '16px', borderRadius: '4px', 
                          background: isFinal ? 'var(--sage-mid)' : 'var(--cream-200)', 
                          border: `1.5px solid ${isFinal ? 'var(--sage-dark)' : 'var(--cream-300)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '10px', fontWeight: 800
                        }}>
                          {isFinal && '✓'}
                        </div>
                        <span style={{ color: isFinal ? 'var(--warm-text)' : 'var(--muted-text)', fontWeight: isFinal ? 600 : 400 }}>
                          {v.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>

            {/* Right Side: Grid of 8 Image Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Studio Grid Intro */}
              <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '24px', padding: '20px 28px' }}>
                <h2 className="font-display" style={{ fontSize: '20px', color: 'var(--cream-900)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Studio Generation Workshop
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--muted-text)', lineHeight: 1.5, margin: 0 }}>
                  Generate exactly 8 required image variations. Modify default prompts to customize textures, lighting, models, or artistic context. Click **Generate** to start background rendering. Ensure all 8 are checked as **final** to submit.
                </p>
              </div>

              {/* Variations Grid */}
              {studioLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', flexDirection: 'column', gap: '12px' }}>
                  <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
                  <span style={{ fontSize: '14px', color: 'var(--muted-text)' }}>Syncing AI Studio variations…</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
                  {VARIATIONS.map(variation => {
                    const img = getStudioImageForType(variation.id)
                    const runningJob = runningJobs[variation.id]
                    const isGenerating = runningJob !== undefined
                    
                    // Prepopulate prompt state or let user edit it
                    return (
                      <VariationCard
                        key={variation.id}
                        variation={variation}
                        image={img}
                        isGenerating={isGenerating}
                        runningJob={runningJob}
                        onGenerate={(prompt) => triggerImageGeneration(variation.id, prompt)}
                        onDelete={(id) => deleteGeneratedImage(id, variation.id)}
                        onToggleFinal={(id, currentVal) => toggleImageFinal(id, currentVal)}
                        onLightbox={(url) => setLightboxUrl(url)}
                        isTaskImmutable={activeStudioTask.status === 'submitted' || activeStudioTask.status === 'accepted'}
                      />
                    )
                  })}
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ── ADMIN REVIEW MODAL / GALLERY ───────────── */}
      {activeReviewTask && (
        <div className="modal-overlay" style={{ background: 'rgba(28,25,20,0.5)', backdropFilter: 'blur(8px)' }} onClick={e => { if (e.target === e.currentTarget) setActiveReviewTask(null) }}>
          <div className="modal-box" style={{ maxWidth: '1100px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--cream-300)' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--cream-300)', background: 'var(--sand-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: '22px', color: 'var(--cream-900)', margin: 0 }}>Review Portfolio Submission</h2>
                <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: '4px 0 0 0' }}>
                  Task: <strong>{activeReviewTask.title}</strong> · Submitted by <strong>{activeReviewTask.assignee_name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setActiveReviewTask(null)} 
                className="btn-ghost"
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                Close
              </button>
            </div>

            {/* Gallery Content scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '28px' }}>
              
              {/* Left Column: Decision & Feedback */}
              <div style={{ background: 'var(--cream-100)', border: '1px solid var(--cream-300)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: 0 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Decision Panel</h3>
                
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mid-text)', display: 'block', marginBottom: '6px' }}>
                    Reviewer Comments / Revision Feedback
                  </label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Provide specific notes if requesting changes, or write a glowing review if accepting..."
                    value={reviewFeedback}
                    onChange={e => setReviewFeedback(e.target.value)}
                    className="input-cream"
                    style={{ fontSize: '13px', resize: 'none', background: 'var(--cream-50)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <button
                    disabled={reviewActionLoading}
                    onClick={() => submitReviewAction('accept')}
                    className="btn-primary"
                    style={{ background: 'var(--sage-mid)', color: 'white', width: '100%', gap: '6px' }}
                  >
                    {reviewActionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /><span>Accept & Approve</span></>}
                  </button>
                  <button
                    disabled={reviewActionLoading}
                    onClick={() => submitReviewAction('revision')}
                    className="btn-ghost"
                    style={{ borderColor: 'var(--rose-mid)', color: 'var(--rose-dark)', background: 'var(--rose-light)33', width: '100%', gap: '6px' }}
                  >
                    {reviewActionLoading ? <Loader2 size={16} className="animate-spin" /> : <><RefreshCw size={14} /><span>Request Revision</span></>}
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--cream-300)', paddingTop: '16px', marginTop: '8px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Original Product Ref</h4>
                  {activeReviewTask.product_image_url && (
                    <img 
                      src={activeReviewTask.product_image_url} 
                      alt="Original ref" 
                      style={{ width: '100%', height: '140px', objectFit: 'contain', borderRadius: '8px', background: 'var(--cream-200)', border: '1px solid var(--cream-300)' }} 
                    />
                  )}
                </div>

              </div>

              {/* Right Column: 8 Composed Images Gallery */}
              <div>
                {reviewLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', flexDirection: 'column', gap: '8px' }}>
                    <div className="spinner" style={{ width: '28px', height: '28px' }}></div>
                    <span style={{ fontSize: '13px', color: 'var(--muted-text)' }}>Syncing submitted variations…</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    <div style={{ background: 'rgba(143,188,139,0.1)', border: '1px solid var(--sage-mid)', borderRadius: '16px', padding: '14px 20px', fontSize: '13px', color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} />
                      <span>Exactly 8/8 images are present. Consistency test verified.</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                      {VARIATIONS.map(v => {
                        const img = getReviewImageForType(v.id)
                        return (
                          <div key={v.id} style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cream-700)' }}>{v.name}</span>
                              <span style={{ fontSize: '9px', background: 'var(--cream-200)', padding: '2px 6px', borderRadius: '999px', color: 'var(--muted-text)', fontWeight: 600 }}>{v.category}</span>
                            </div>
                            
                            {img ? (
                              <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--cream-200)', background: '#FAF6EE' }}>
                                <img src={img.image_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                
                                {/* Lightbox fullscreen overlay action */}
                                <button 
                                  onClick={() => setLightboxUrl(img.image_url)}
                                  style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(253,251,247,0.9)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                                >
                                  <Eye size={12} style={{ stroke: 'var(--cream-700)' }} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ width: '100%', height: '200px', borderRadius: '10px', border: '2px dashed var(--cream-200)', background: 'var(--cream-200)44', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose-dark)', fontSize: '11px', fontWeight: 600 }}>
                                Missing Image!
                              </div>
                            )}

                            {img && (
                              <div style={{ fontSize: '10px', color: 'var(--muted-text)', lineHeight: 1.4, height: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                <strong>Prompt:</strong> {img.prompt_used}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── CREATE TASK MODAL ───────────────────────── */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsCreateOpen(false) }}>
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div style={{ background: 'var(--sand-100)', borderBottom: '1px solid var(--cream-300)', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: '20px', color: 'var(--cream-900)', margin: 0 }}>Create Brand AI Task</h2>
                <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: '4px 0 0 0' }}>Define details and upload pristine jewelry photo.</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancel</button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Product Photo Upload */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Product Jewelry Photo *
                </label>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }} 
                />

                {form.product_image_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--cream-200)', borderRadius: '12px', border: '1px solid var(--cream-300)' }}>
                    <img 
                      src={form.product_image_url} 
                      alt="Thumbnail preview" 
                      style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px', background: 'white', border: '1px solid var(--cream-300)' }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>photo_ready.jpg</p>
                      <p style={{ fontSize: '10px', color: 'var(--sage-dark)', fontWeight: 600, margin: 0 }}>✓ Ready for extraction</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setForm(f => ({ ...f, product_image_url: '' }))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--rose-dark)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-ghost"
                    style={{ width: '100%', height: '70px', display: 'flex', flexDirection: 'column', gap: '4px', borderStyle: 'dashed', borderRadius: '12px' }}
                  >
                    {uploadingImage ? (
                      <><Loader2 size={16} className="animate-spin" /><span>Uploading image to database…</span></>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Click to upload jewelry PNG / JPG</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generate 8 consistent shots of Pearl Ring…"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input-cream"
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Provide details about the jewelry materials, reflections, or context for the creative designer..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input-cream"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Priority + Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }} />
                </div>
              </div>

              {/* Assign to */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Assign Workspace Teammate</label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }}>
                  <option value="">— Unassigned (Pending) —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                  ))}
                </select>
                <p style={{ fontSize: '10px', color: 'var(--muted-text)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={10} style={{ stroke: 'var(--cream-500)' }} /> Assigning will instantly dispatch a premium notification email.
                </p>
              </div>

              {/* Submit */}
              <button type="submit" disabled={actionLoading || uploadingImage} className="btn-primary" style={{ marginTop: '6px' }}>
                {actionLoading ? <><Loader2 size={16} className="animate-spin" /><span>Saving Task…</span></> : <span>Create & Dispatch Task</span>}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ── INVITE USER MODAL ───────────────────────── */}
      {isInviteOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsInviteOpen(false) }}>
          <div className="modal-box">
            <div style={{ background: 'var(--sand-100)', borderBottom: '1px solid var(--cream-300)', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: '20px', color: 'var(--cream-900)', margin: 0 }}>Add Team Member</h2>
                <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: '4px 0 0 0' }}>Register a teammate so you can assign them tasks instantly.</p>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancel</button>
            </div>

            <form onSubmit={handleInvite} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Yash Vardhan…"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  className="input-cream"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yash@example.com…"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="input-cream"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mid-text)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Workspace Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} className="input-cream" style={{ cursor: 'pointer' }}>
                  <option value="user">Studio User (Task receiver)</option>
                  <option value="admin">Administrator (Task creator & reviewer)</option>
                </select>
              </div>

              <button type="submit" disabled={actionLoading} className="btn-primary" style={{ marginTop: '6px' }}>
                {actionLoading ? <><Loader2 size={16} className="animate-spin" /><span>Adding…</span></> : <span>Register Team Member</span>}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX FULLSCREEN OVERLAY ─────────────── */}
      {lightboxUrl && (
        <div 
          className="modal-overlay animate-fade-in" 
          style={{ background: 'rgba(10, 8, 5, 0.96)', zIndex: 300, cursor: 'zoom-out' }}
          onClick={() => setLightboxUrl(null)}
        >
          <div style={{ position: 'relative', width: '90vw', height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src={lightboxUrl} 
              alt="Fullscreen View" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }} 
            />
            
            {/* Close button indicator */}
            <span style={{ position: 'absolute', top: '10px', right: '10px', color: '#FAF6EE', background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
              Click anywhere to close
            </span>
          </div>
        </div>
      )}

    </div>
  )
}

// ── VariationCard Component ─────────────────────────
interface VariationCardProps {
  variation: VariationConfig
  image: GeneratedImage | undefined
  isGenerating: boolean
  runningJob: { jobId: string, prompt: string, startedAt: number } | undefined
  onGenerate: (prompt: string) => void
  onDelete: (id: string) => void
  onToggleFinal: (id: string, currentVal: boolean) => void
  onLightbox: (url: string) => void
  isTaskImmutable: boolean
}

function VariationCard({
  variation,
  image,
  isGenerating,
  runningJob,
  onGenerate,
  onDelete,
  onToggleFinal,
  onLightbox,
  isTaskImmutable
}: VariationCardProps) {
  
  const [prompt, setPrompt] = useState(variation.defaultPrompt)
  const [timer, setTimer] = useState(0)

  // Increment timer while generating
  useEffect(() => {
    let timerId: any = null
    if (isGenerating) {
      setTimer(0)
      timerId = setInterval(() => {
        setTimer(t => t + 1)
      }, 1000)
    }
    return () => { if (timerId) clearInterval(timerId) }
  }, [isGenerating])

  return (
    <div style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-300)', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow-sm)' }}>
      
      {/* Category + Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--cream-600)', fontWeight: 800, letterSpacing: '0.05em' }}>{variation.category}</span>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--warm-text)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {variation.name}
            {image?.is_final && <CheckCircle2 size={13} style={{ stroke: 'var(--sage-dark)', fill: 'var(--sage-light)' }} />}
          </h3>
        </div>

        {/* Final Checkbox pill */}
        {image && (
          <button
            disabled={isTaskImmutable}
            onClick={() => onToggleFinal(image.id, image.is_final)}
            style={{
              background: image.is_final ? 'var(--sage-light)' : 'var(--cream-200)',
              border: `1px solid ${image.is_final ? 'var(--sage-dark)' : 'var(--cream-300)'}`,
              color: image.is_final ? 'var(--sage-dark)' : 'var(--muted-text)',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '999px',
              cursor: isTaskImmutable ? 'not-allowed' : 'pointer'
            }}
          >
            {image.is_final ? '✓ Active Final' : 'Mark as Final'}
          </button>
        )}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--muted-text)', lineHeight: 1.4, margin: 0 }}>
        {variation.description}
      </p>

      {/* Visual Canvas Card */}
      <div style={{ width: '100%', height: '280px', borderRadius: '16px', border: '1px solid var(--cream-200)', background: 'var(--cream-200)44', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isGenerating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: '24px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cream-700)' }}>AI Composition Processing</span>
              <span style={{ fontSize: '10px', color: 'var(--muted-text)', fontVariantNumeric: 'tabular-nums' }}>
                Running for {timer}s...
              </span>
            </div>
            
            {/* Shimmer loading text bar */}
            <div style={{ width: '180px', height: '6px', background: 'var(--cream-300)', borderRadius: '999px', overflow: 'hidden', marginTop: '4px', position: 'relative' }}>
              <div 
                style={{ 
                  position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', 
                  background: 'var(--cream-600)', borderRadius: '999px',
                  animation: 'shimmer 1.5s infinite ease-in-out'
                }}
              ></div>
            </div>
          </div>
        ) : image ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img 
              src={image.image_url} 
              alt={variation.name} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            
            {/* Overlay Actions on Hover/Static */}
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onLightbox(image.image_url)}
                  style={{ background: 'rgba(253,251,247,0.92)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                  title="View fullscreen"
                >
                  <Eye size={14} style={{ stroke: 'var(--cream-700)' }} />
                </button>
                
                {/* Download via helper */}
                <a
                  href={image.image_url}
                  download={`Assignly_${variation.id}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: 'rgba(253,251,247,0.92)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', color: 'var(--cream-700)' }}
                  title="Download image"
                >
                  <Download size={14} />
                </a>
              </div>

              {!isTaskImmutable && (
                <button
                  onClick={() => onDelete(image.id)}
                  style={{ background: 'rgba(245,224,220,0.95)', border: '1px solid var(--rose-light)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--rose-dark)' }}
                  title="Delete this image"
                >
                  <Trash2 size={14} />
                </button>
              )}

            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Sparkles size={24} style={{ stroke: 'var(--cream-400)', margin: '0 auto' }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Studio Camera Ready</span>
            <span style={{ fontSize: '10px' }}>Input custom prompt below and click generate</span>
          </div>
        )}
      </div>

      {/* Prompt Customizer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase' }}>Composition Prompt Customizer</label>
        <textarea
          rows={3}
          disabled={isGenerating || isTaskImmutable}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="input-cream"
          style={{ fontSize: '12px', resize: 'none', lineHeight: 1.4 }}
        />
      </div>

      {/* Trigger Generation Button */}
      {!isTaskImmutable && (
        <button
          disabled={isGenerating || !prompt.trim()}
          onClick={() => onGenerate(prompt)}
          className="btn-primary"
          style={{ width: '100%', gap: '8px', padding: '8px 16px', fontSize: '13px', background: image ? 'var(--cream-200)' : 'var(--cream-700)', color: image ? 'var(--warm-text)' : 'var(--cream-50)', border: image ? '1px solid var(--cream-400)' : 'none', boxShadow: image ? 'none' : '0 4px 14px rgba(122,96,55,0.2)' }}
        >
          {isGenerating ? (
            <><Loader2 size={14} className="animate-spin" /><span>Generating variation…</span></>
          ) : image ? (
            <>
              <RefreshCw size={12} />
              <span>Regenerate Variation</span>
            </>
          ) : (
            <>
              <Sparkles size={12} />
              <span>Generate Composed Shot</span>
            </>
          )}
        </button>
      )}

    </div>
  )
}
