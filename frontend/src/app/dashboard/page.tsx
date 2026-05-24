'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { 
  Plus, LogOut, CheckCircle2, Circle, Clock, LayoutGrid, Users, 
  Trash2, User, Search, AlertCircle, Calendar, Star, KanbanSquare, SlidersHorizontal
} from 'lucide-react'

// Define interfaces for TypeScript safety
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
  status: string // 'todo', 'in_progress', 'completed'
  priority: string // 'low', 'medium', 'high'
  due_date: string | null
  created_by: string
  assigned_to: string | null
  created_at: string
  updated_at: string
  creator_name: string
  assignee_name: string
  assignee_email: string | null
  assignee_avatar: string | null
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  
  // Auth state
  const [session, setSession] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // API state
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Form state
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskAssignedTo, setTaskAssignedTo] = useState('')

  // 1. Authenticate user session
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/')
      } else {
        setSession(session)
        setUserProfile(session.user)
        setAuthLoading(false)
      }
    }
    
    getSession()
  }, [router, supabase])

  // 2. Fetch Tasks & Users from Flask backend once session exists
  useEffect(() => {
    if (!session) return

    fetchTasks()
    fetchUsers()
  }, [session])

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    }
  }

  const fetchTasks = async () => {
    setLoadingTasks(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks`, {
        headers: getHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()
      setTasks(data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingTasks(false)
    }
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users`, {
        headers: getHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch profiles')
      const data = await res.json()
      setUsers(data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingUsers(false)
    }
  }

  // 3. Create Task Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    setActionLoading(true)
    try {
      const body = {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
        assigned_to: taskAssignedTo || null,
        status: 'todo'
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create task')
      }

      // Reset form
      setTaskTitle('')
      setTaskDescription('')
      setTaskPriority('medium')
      setTaskDueDate('')
      setTaskAssignedTo('')
      setIsCreateOpen(false)

      // Refresh tasks
      fetchTasks()
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // 4. Update Task Status
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) throw new Error('Failed to update status')
      
      // Update local state smoothly
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    } catch (err: any) {
      alert(err.message)
    }
  }

  // 5. Delete Task Handler (restricted to Creator in Flask, we check locally too)
  const handleDeleteTask = async (taskId: string, creatorId: string) => {
    if (creatorId !== userProfile?.id) {
      alert('Only the task creator is authorized to delete this task.')
      return
    }

    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getHeaders()
      })

      if (!res.ok) throw new Error('Failed to delete task')
      
      // Update state
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err: any) {
      alert(err.message)
    }
  }

  // 6. Sign Out Handler
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Filter Tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    const matchesAssignee = assigneeFilter === 'all' || 
                            (assigneeFilter === 'assigned_to_me' && task.assigned_to === userProfile?.id) ||
                            (assigneeFilter === 'created_by_me' && task.created_by === userProfile?.id)
    return matchesSearch && matchesPriority && matchesAssignee
  })

  // Calculate Metrics
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const pendingTasks = tasks.filter(t => t.status !== 'completed').length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-15%] w-[45%] h-[40%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>

      {/* Nav */}
      <nav className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-md shadow-indigo-600/20">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Assignly</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img 
                src={userProfile?.user_metadata?.avatar_url || userProfile?.user_metadata?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${userProfile?.email}`} 
                alt="Profile Avatar" 
                className="w-9 h-9 rounded-xl border border-slate-800 object-cover shadow-inner"
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-200">{userProfile?.user_metadata?.full_name || 'Collaborator'}</span>
                <span className="text-[10px] text-slate-500">{userProfile?.email}</span>
              </div>
            </div>

            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 bg-slate-900/60 border border-slate-800 hover:border-rose-900/50 hover:bg-rose-950/10 px-3.5 py-2 rounded-xl transition duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Body */}
      <main className="max-w-7xl w-full mx-auto px-6 py-10 flex-grow space-y-8 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Workspace Dashboard</h1>
            <p className="text-xs md:text-sm text-slate-400">Track and assign deliverables with real-time Gmail and database synchronization.</p>
          </div>

          <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-3 px-5 rounded-xl transition duration-300 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Task</span>
          </button>
        </div>

        {/* Dynamic Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-5 backdrop-blur-md flex items-center gap-4 shadow-sm">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-indigo-400">
              <KanbanSquare className="w-6 h-6" />
            </div>
            <div>
              <span className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Total Tasks</span>
              <h3 className="text-lg md:text-2xl font-black mt-0.5">{loadingTasks ? '...' : totalTasks}</h3>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-5 backdrop-blur-md flex items-center gap-4 shadow-sm">
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Pending Tasks</span>
              <h3 className="text-lg md:text-2xl font-black mt-0.5">{loadingTasks ? '...' : pendingTasks}</h3>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-5 backdrop-blur-md flex items-center gap-4 shadow-sm">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Completed</span>
              <h3 className="text-lg md:text-2xl font-black mt-0.5">{loadingTasks ? '...' : completedTasks}</h3>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-5 backdrop-blur-md flex items-center gap-4 shadow-sm">
            <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl text-purple-400">
              <Star className="w-6 h-6" />
            </div>
            <div className="flex-grow">
              <span className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider">Completion Rate</span>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-lg md:text-xl font-black">{loadingTasks ? '...' : `${completionRate}%`}</span>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2 overflow-hidden hidden sm:block">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-600 transition"
            />
          </div>

          {/* Filtering Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] text-slate-400 font-bold uppercase">Filter:</span>
            </div>

            {/* Scope Filter */}
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-indigo-600 transition"
            >
              <option value="all">All Workspace Tasks</option>
              <option value="assigned_to_me">Assigned to Me</option>
              <option value="created_by_me">Created by Me</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-indigo-600 transition"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Task Columns / Kanban Board */}
        {loadingTasks ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-500">Retrieving task board...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columns definitions */}
            {[
              { id: 'todo', name: 'To Do', color: 'bg-indigo-500', icon: <Circle className="w-4 h-4 text-indigo-400" /> },
              { id: 'in_progress', name: 'In Progress', color: 'bg-amber-500', icon: <Clock className="w-4 h-4 text-amber-400" /> },
              { id: 'completed', name: 'Completed', color: 'bg-emerald-500', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> }
            ].map(col => {
              const columnTasks = filteredTasks.filter(t => t.status === col.id)
              
              return (
                <div key={col.id} className="flex flex-col bg-slate-900/30 border border-slate-900/60 rounded-2xl p-4 min-h-[500px]">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-900/60 mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.color}`}></span>
                      <h3 className="font-bold text-sm text-slate-200">{col.name}</h3>
                      <span className="text-xs bg-slate-900 border border-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                        {columnTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards */}
                  <div className="flex-grow space-y-4 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {columnTasks.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 text-xs gap-1.5 p-4">
                        <AlertCircle className="w-4 h-4" />
                        <span>No tasks in this stage</span>
                      </div>
                    ) : (
                      columnTasks.map(task => {
                        const isCreator = task.created_by === userProfile?.id
                        
                        return (
                          <div 
                            key={task.id}
                            className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl space-y-3 relative group hover:border-slate-700/80 hover:shadow-lg transition duration-300"
                          >
                            {/* Card priority badge */}
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' :
                                task.priority === 'medium' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                              }`}>
                                {task.priority}
                              </span>

                              {/* Dropdown status update options */}
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={task.status}
                                  onChange={e => handleUpdateStatus(task.id, e.target.value)}
                                  className="bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 px-2 py-1 rounded focus:outline-none"
                                >
                                  <option value="todo">To Do</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                </select>

                                {/* Delete action enabled only for task creator */}
                                {isCreator && (
                                  <button
                                    onClick={() => handleDeleteTask(task.id, task.created_by)}
                                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition duration-200"
                                    title="Delete task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Card Content */}
                            <div className="space-y-1.5">
                              <h4 className={`font-bold text-sm leading-tight text-slate-100 ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className={`text-xs text-slate-400 leading-normal line-clamp-3 ${task.status === 'completed' ? 'line-through text-slate-600' : ''}`}>
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Card Footer: due date & Assignee profile */}
                            <div className="pt-3 border-t border-slate-950 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                <span>{task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}</span>
                              </div>

                              <div className="flex items-center gap-1.5 max-w-[120px]" title={`Assigned to: ${task.assignee_name}`}>
                                {task.assignee_avatar ? (
                                  <img 
                                    src={task.assignee_avatar} 
                                    alt={task.assignee_name} 
                                    className="w-4 h-4 rounded-full border border-slate-800 object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 text-[8px] text-slate-400 font-bold uppercase">
                                    {task.assignee_name.charAt(0)}
                                  </div>
                                )}
                                <span className="truncate max-w-[80px] font-medium text-slate-400">{task.assignee_name}</span>
                              </div>
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

      {/* 7. Beautiful Modal Overlay: Create Task Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Create Workspace Task</span>
              </h2>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg"
              >
                Cancel
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Review layout deliverables..."
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-600 transition"
                />
              </div>

              {/* Task Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea 
                  placeholder="Provide essential details or bullet points..."
                  value={taskDescription}
                  onChange={e => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-600 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                {/* Due Date Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                  <input 
                    type="date" 
                    value={taskDueDate}
                    onChange={e => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition text-slate-300"
                  />
                </div>
              </div>

              {/* Assignee Search Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assign Task To</label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 w-4 h-4 text-slate-600" />
                  <select
                    value={taskAssignedTo}
                    onChange={e => setTaskAssignedTo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition text-slate-300"
                  >
                    <option value="">Unassigned (Keep in general backlog)</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500">The assignee will immediately receive a beautiful transactional notification email via Gmail.</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition duration-300 shadow-lg shadow-indigo-600/10"
              >
                {actionLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create & Notify Assignee</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-slate-700 border-t border-slate-900/60 mt-auto shrink-0">
        <p>&copy; 2026 Assignly Task Systems. Fully authenticated by Google OAuth.</p>
      </footer>
    </div>
  )
}
