import { create } from 'zustand'

export type MemoryType = 'text' | 'voice' | 'link' | 'image'

export interface Memory {
  id: string
  type: MemoryType
  title: string
  content: string
  summary: string | null
  tags: string[]
  sourceUrl: string | null
  fileUrl: string | null
  imagePreview: string | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  collections: { id: string; name: string; color: string; icon?: string }[]
}

export interface Collection {
  id: string
  name: string
  icon: string
  color: string
  createdAt: string
  memoryCount: number
}

export type AppView = 'dashboard' | 'ask' | 'collections' | 'memories' | 'settings'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

// ─── Supabase row mappers ────────────────────────────────────────────
interface SupabaseMemoryRow {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  summary: string | null
  tags: string
  source_url: string | null
  file_url: string | null
  image_preview: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
  memory_collections?: { collection_id: string; collections: { id: string; name: string; color: string; icon: string } }[]
}

interface SupabaseCollectionRow {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  created_at: string
  memory_collections?: { id: string }[]
}

function mapSupabaseMemory(row: SupabaseMemoryRow): Memory {
  return {
    id: row.id,
    type: (row.type as MemoryType) || 'text',
    title: row.title || '',
    content: row.content || '',
    summary: row.summary,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    sourceUrl: row.source_url,
    fileUrl: row.file_url,
    imagePreview: row.image_preview,
    isFavorite: row.is_favorite || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    collections: row.memory_collections?.map((mc) => ({
      id: mc.collections.id,
      name: mc.collections.name,
      color: mc.collections.color,
      icon: mc.collections.icon,
    })) || [],
  }
}

function mapSupabaseCollection(row: SupabaseCollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || '📁',
    color: row.color || '#6D597A',
    createdAt: row.created_at,
    memoryCount: row.memory_collections?.length || 0,
  }
}

// ─── Smart Token Saver: Local, free, instant tagging ──────────────────
function getLocalTags(text: string): string[] {
  const lower = text.toLowerCase()
  const tags: string[] = []

  // URL detection → 'link'
  if (/https?:\/\//.test(lower)) {
    tags.push('link')
  }

  // Task words → 'task'
  if (/\b(todo|remind|need to|must|buy)\b/.test(lower)) {
    tags.push('task')
  }

  // Person/personal words → 'personal'
  if (/\b(i |me |with |call|email)\b/.test(lower)) {
    tags.push('personal')
  }

  // Question/idea words → 'idea'
  if (/\b(what|how|why|who)\b/.test(lower)) {
    tags.push('idea')
  }

  return tags.slice(0, 5)
}

// ─── Extended keyword-based auto-tagging (richer, for AI fallback) ───
function autoGenerateTags(content: string, title: string): string[] {
  const text = `${title} ${content}`.toLowerCase()
  const tagMap: Record<string, string[]> = {
    'work': ['meeting', 'project', 'deadline', 'client', 'office', 'team', 'q1', 'q2', 'q3', 'q4', 'quarterly', 'strategy'],
    'personal': ['routine', 'morning', 'exercise', 'meditation', 'journal', 'habit'],
    'travel': ['trip', 'itinerary', 'flight', 'hotel', 'visit', 'tokyo', 'paris', 'destination'],
    'learning': ['learn', 'study', 'course', 'tutorial', 'book', 'read', 'article'],
    'code': ['code', 'programming', 'react', 'javascript', 'typescript', 'api', 'bug', 'feature', 'css', 'html', 'framework'],
    'design': ['design', 'ui', 'ux', 'layout', 'color', 'font', 'figma', 'wireframe'],
    'ai': ['ai', 'machine learning', 'neural', 'model', 'gpt', 'gemini', 'llm', 'chatbot'],
    'recipe': ['recipe', 'cook', 'bake', 'ingredient', 'food', 'meal', 'breakfast', 'dinner'],
    'idea': ['idea', 'concept', 'brainstorm', 'innovative', 'startup', 'prototype'],
    'finance': ['budget', 'expense', 'invest', 'savings', 'money', 'cost'],
  }

  const tags: string[] = []
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.push(tag)
    }
  }
  return tags.slice(0, 5)
}

// ─── Supabase browser client helper ──────────────────────────────────
async function getSupabaseBrowser() {
  const { createClient } = await import('@/lib/supabase/browser')
  return createClient()
}

// ─── Store ───────────────────────────────────────────────────────────
interface AetherState {
  // Navigation
  currentView: AppView
  setCurrentView: (view: AppView) => void

  // Auth
  user: AuthUser | null
  isAuthenticated: boolean
  showAuthModal: boolean
  pendingAction: (() => void) | null
  supabaseReady: boolean // true when Supabase tables exist for this user
  setUser: (user: AuthUser | null) => void
  setShowAuthModal: (show: boolean) => void
  requireAuth: (action: () => void) => void
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  checkSupabaseTables: () => Promise<boolean>

  // Data
  memories: Memory[]
  collections: Collection[]
  isLoading: boolean

  // Selected
  selectedMemoryId: string | null
  selectedCollectionId: string | null

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void
  filterType: MemoryType | 'all'
  setFilterType: (t: MemoryType | 'all') => void

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void
  clearChat: () => void

  // Theme
  darkMode: boolean
  toggleDarkMode: () => void

  // Data actions
  setMemories: (memories: Memory[]) => void
  setCollections: (collections: Collection[]) => void
  setLoading: (loading: boolean) => void
  setSelectedMemoryId: (id: string | null) => void
  setSelectedCollectionId: (id: string | null) => void
  addMemory: (memory: Memory) => void
  updateMemory: (id: string, updates: Partial<Memory>) => void
  deleteMemory: (id: string) => void
  addCollection: (collection: Collection) => void
  updateCollection: (id: string, updates: Partial<Collection>) => void
  deleteCollection: (id: string) => void
  fetchMemories: () => Promise<void>
  fetchCollections: () => Promise<void>

  // Supabase-aware save
  saveMemory: (data: { type: MemoryType; title: string; content: string; sourceUrl?: string | null; tags?: string[]; collectionIds?: string[]; imagePreview?: string | null; fileUrl?: string | null }) => Promise<Memory | null>
  saveCollection: (data: { name: string; color?: string; icon?: string }) => Promise<Collection | null>

  // Delete memory from DB
  deleteMemoryFromDB: (id: string) => Promise<void>

  // Background AI auto-tagging (non-blocking)
  backgroundAutoTag: (memoryId: string, content: string, title: string) => Promise<void>

  // Background AI summary generation (non-blocking)
  backgroundAutoSummary: (memoryId: string, content: string) => Promise<void>

  // Background link content reading (non-blocking)
  backgroundReadLink: (memoryId: string, url: string) => Promise<void>

  // Background embedding generation for semantic search (non-blocking)
  backgroundGenerateEmbedding: (memoryId: string, content: string) => Promise<void>
}

export const useAetherStore = create<AetherState>((set, get) => ({
  // Navigation
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view, selectedMemoryId: null, selectedCollectionId: null }),

  // Auth — start as "local" user, no auth gate
  user: { id: 'local', email: '', name: 'Aether User', avatarUrl: null },
  isAuthenticated: false,
  showAuthModal: false,
  pendingAction: null,
  supabaseReady: false,
  setUser: (user) => set({ user, isAuthenticated: !!user && user.id !== 'local' }),
  setShowAuthModal: (showAuthModal) => set({ showAuthModal }),

  // The gate: if user is signed in, run action immediately. Otherwise, queue it and show modal.
  requireAuth: (action) => {
    const state = get()
    if (state.isAuthenticated && state.user && state.user.id !== 'local') {
      action()
    } else {
      set({ showAuthModal: true, pendingAction: action })
    }
  },

  login: async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || '',
            avatarUrl: data.user.user_metadata?.avatar_url || null,
          },
          isAuthenticated: true,
          showAuthModal: false,
        })
        // Check if Supabase tables exist
        get().checkSupabaseTables()
        // Execute any pending action that was queued
        const pending = get().pendingAction
        if (pending) {
          pending()
          set({ pendingAction: null })
        }
        // Re-fetch data from Supabase
        get().fetchMemories()
        get().fetchCollections()
        return true
      }
      return false
    } catch {
      return false
    }
  },

  signup: async (email, password, name) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email || '',
            name: name || '',
            avatarUrl: null,
          },
          isAuthenticated: true,
          showAuthModal: false,
        })
        // Check if Supabase tables exist
        get().checkSupabaseTables()
        // Execute any pending action
        const pending = get().pendingAction
        if (pending) {
          pending()
          set({ pendingAction: null })
        }
        return true
      }
      return false
    } catch {
      return false
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    set({
      user: { id: 'local', email: '', name: 'Aether User', avatarUrl: null },
      isAuthenticated: false,
      supabaseReady: false,
      chatMessages: [],
    })
    // Reload data as local user
    get().fetchMemories()
    get().fetchCollections()
  },

  checkSession: async () => {
    try {
      const res = await fetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user) {
          set({ user: data.user, isAuthenticated: true })
          // Check Supabase tables + fetch data
          get().checkSupabaseTables()
          return
        }
      }
    } catch { /* ignore */ }
    // No Supabase session — stay as local user (not gated)
    set({ isAuthenticated: false })
  },

  // Check if Supabase tables exist for the current user
  checkSupabaseTables: async () => {
    try {
      const supabase = await getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        set({ supabaseReady: false })
        return false
      }

      // Try a minimal query to see if the memories table exists
      const { error } = await supabase
        .from('memories')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      const ready = !error
      set({ supabaseReady: ready })
      return ready
    } catch {
      set({ supabaseReady: false })
      return false
    }
  },

  // Data
  memories: [],
  collections: [],
  isLoading: false,

  // Selected
  selectedMemoryId: null,
  selectedCollectionId: null,

  // Search
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  filterType: 'all',
  setFilterType: (t) => set({ filterType: t }),

  // Chat
  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),

  // Theme
  darkMode: false,
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  // Data actions
  setMemories: (memories) => set({ memories }),
  setCollections: (collections) => set({ collections }),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedMemoryId: (id) => set({ selectedMemoryId: id }),
  setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
  addMemory: (memory) => set((s) => ({ memories: [memory, ...s.memories] })),
  updateMemory: (id, updates) => set((s) => ({
    memories: s.memories.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  deleteMemory: (id) => set((s) => ({
    memories: s.memories.filter((m) => m.id !== id),
  })),
  addCollection: (collection) => set((s) => ({
    collections: [...s.collections, collection],
  })),
  updateCollection: (id, updates) => set((s) => ({
    collections: s.collections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
  })),
  deleteCollection: (id) => set((s) => ({
    collections: s.collections.filter((c) => c.id !== id),
  })),

  // ── Fetch Memories ──────────────────────────────────────────────────
  fetchMemories: async () => {
    set({ isLoading: true })
    const state = get()
    if (state.isAuthenticated && state.supabaseReady) {
      try {
        const supabase = await getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No session')

        const { data, error } = await supabase
          .from('memories')
          .select('*, memory_collections(collection_id, collections(id, name, color, icon))')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const memories = (data as SupabaseMemoryRow[]).map(mapSupabaseMemory)
        set({ memories, isLoading: false })
        return
      } catch {
        // Fall through to Prisma API
      }
    }

    // Fallback: fetch from Prisma API
    try {
      const res = await fetch('/api/memories')
      if (res.ok) {
        const memories = await res.json()
        set({ memories, isLoading: false })
        return
      }
    } catch (e) {
      console.error('Failed to fetch memories:', e)
    }
    set({ isLoading: false })
  },

  // ── Fetch Collections ───────────────────────────────────────────────
  fetchCollections: async () => {
    const state = get()
    if (state.isAuthenticated && state.supabaseReady) {
      try {
        const supabase = await getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No session')

        const { data, error } = await supabase
          .from('collections')
          .select('*, memory_collections(id)')
          .eq('user_id', session.user.id)
          .order('name', { ascending: true })

        if (error) throw error

        const collections = (data as SupabaseCollectionRow[]).map(mapSupabaseCollection)
        set({ collections })
        return
      } catch {
        // Fall through to Prisma API
      }
    }

    // Fallback: fetch from Prisma API
    try {
      const res = await fetch('/api/collections')
      if (res.ok) {
        const collections = await res.json()
        set({ collections })
      }
    } catch (e) {
      console.error('Failed to fetch collections:', e)
    }
  },

  // ── Delete Memory from DB (Supabase or Prisma) ─────────────────────
  deleteMemoryFromDB: async (id: string) => {
    const state = get()

    // Authenticated + Supabase: delete from Supabase
    if (state.isAuthenticated && state.supabaseReady) {
      try {
        const supabase = await getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.from('memories').delete().eq('id', id)
        }
      } catch {
        // Fall through to Prisma API
      }
    }

    // Also try Prisma API (works for both local and authenticated users)
    try {
      await fetch(`/api/memories/${id}`, { method: 'DELETE' })
    } catch {
      // Silent fail
    }

    // Remove from local state
    get().deleteMemory(id)
  },

  // ── Background AI auto-tagging (non-blocking) ──────────────────────
  backgroundAutoTag: async (memoryId: string, content: string, title: string) => {
    try {
      const res = await fetch('/api/auto-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `${title} ${content}`.slice(0, 1000) }),
      })

      if (!res.ok) return

      const { tags: aiTags } = await res.json()
      if (!aiTags || !aiTags.length) return

      const state = get()

      // Update in Supabase if authenticated + ready
      if (state.isAuthenticated && state.supabaseReady) {
        try {
          const supabase = await getSupabaseBrowser()
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            await supabase
              .from('memories')
              .update({ tags: aiTags.join(',') })
              .eq('id', memoryId)
          }
        } catch {
          // Silently fail Supabase update — local state still updates
        }
      } else {
        // Update via Prisma API
        try {
          await fetch(`/api/memories/${memoryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: aiTags }),
          })
        } catch {
          // Silently fail
        }
      }

      // Update the local state so tags appear immediately
      get().updateMemory(memoryId, { tags: aiTags })
    } catch {
      // Non-blocking: never fail the save flow
    }
  },

  // ── Background AI summary generation (non-blocking) ──────────────────
  backgroundAutoSummary: async (memoryId: string, content: string) => {
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.slice(0, 1000) }),
      })

      if (!res.ok) return

      const { summary } = await res.json()
      if (!summary?.trim()) return

      const state = get()

      // Update in Supabase if authenticated + ready
      if (state.isAuthenticated && state.supabaseReady) {
        try {
          const supabase = await getSupabaseBrowser()
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            await supabase
              .from('memories')
              .update({ summary })
              .eq('id', memoryId)
          }
        } catch {
          // Silently fail
        }
      } else {
        // Update via Prisma API
        try {
          await fetch(`/api/memories/${memoryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary }),
          })
        } catch {
          // Silently fail
        }
      }

      // Update the local state so summary appears immediately
      get().updateMemory(memoryId, { summary })
    } catch {
      // Non-blocking: never fail the save flow
    }
  },

  // ── Background link content reading (non-blocking) ──────────────────
  backgroundReadLink: async (memoryId: string, url: string) => {
    try {
      const res = await fetch('/api/ai/read-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) return

      const { title, content, description } = await res.json()
      if (!content?.trim()) return

      const state = get()

      // Build enriched content: keep original URL + append extracted content
      const enrichedContent = `${url}\n\n---\n\n${content}`.slice(0, 3000)

      // Update in Supabase if authenticated + ready
      if (state.isAuthenticated && state.supabaseReady) {
        try {
          const supabase = await getSupabaseBrowser()
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const updateData: Record<string, string> = { content: enrichedContent }
            if (title?.trim()) updateData.title = title
            if (description?.trim()) updateData.summary = description
            await supabase
              .from('memories')
              .update(updateData)
              .eq('id', memoryId)
          }
        } catch {
          // Silently fail
        }
      } else {
        // Update via Prisma API
        try {
          const updateData: Record<string, unknown> = { content: enrichedContent }
          if (title?.trim()) updateData.title = title
          if (description?.trim()) updateData.summary = description
          await fetch(`/api/memories/${memoryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          })
        } catch {
          // Silently fail
        }
      }

      // Update local state
      const localUpdate: Partial<Memory> = { content: enrichedContent }
      if (title?.trim()) localUpdate.title = title
      if (description?.trim()) localUpdate.summary = description
      get().updateMemory(memoryId, localUpdate)

      // After reading the link, also tag and summarize it with AI
      get().backgroundAutoTag(memoryId, enrichedContent, title || '')
      get().backgroundAutoSummary(memoryId, enrichedContent)
      get().backgroundGenerateEmbedding(memoryId, enrichedContent)
    } catch {
      // Non-blocking: never fail the save flow
    }
  },

  // ── Background embedding generation for semantic search (non-blocking) ──
  backgroundGenerateEmbedding: async (memoryId: string, content: string) => {
    try {
      await fetch('/api/generate-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId, content: content.slice(0, 2000) }),
      })
      // Success is silent — the embedding is now stored in Supabase
    } catch {
      // Non-blocking: never fail the save flow
    }
  },

  // ── Save Memory (Supabase-aware, optimistic UI, token-saving) ────────
  saveMemory: async (data) => {
    const state = get()
    const { type, title, content, sourceUrl, tags, collectionIds, imagePreview, fileUrl } = data

    // ── STEP 1: Smart Token Saver — local, free, instant tags ──────────
    const fullText = `${title || ''} ${content || ''}`.trim()
    const localTags = getLocalTags(fullText)
    const wordCount = fullText.split(/\s+/).filter(Boolean).length

    // If <20 words AND local tags found: use only local tags, skip AI
    const isShortNote = wordCount < 20 && localTags.length > 0

    // Merge tags: caller tags > local tags > extended auto tags
    let finalTags = tags
    if (!tags || tags.length === 0) {
      if (localTags.length > 0) {
        finalTags = localTags
      } else if (content?.trim()) {
        const autoTags = autoGenerateTags(content, title || '')
        if (autoTags.length > 0) finalTags = autoTags
      }
    }

    // ── Authenticated + Supabase ready: save to Supabase directly ──
    if (state.isAuthenticated && state.supabaseReady) {
      try {
        const supabase = await getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No session')

        const { data: memoryRow, error } = await supabase
          .from('memories')
          .insert({
            user_id: session.user.id,
            type: type || 'text',
            title: title || '',
            content: content || '',
            source_url: sourceUrl || null,
            file_url: fileUrl || null,
            image_preview: imagePreview || null,
            tags: finalTags ? (Array.isArray(finalTags) ? finalTags.join(',') : finalTags) : '',
          })
          .select('*, memory_collections(collection_id, collections(id, name, color, icon))')
          .single()

        if (error) throw error

        const memory = mapSupabaseMemory(memoryRow as SupabaseMemoryRow)

        // If collectionIds provided, create junction rows
        if (collectionIds?.length) {
          await supabase.from('memory_collections').insert(
            collectionIds.map((cid: string) => ({
              memory_id: memory.id,
              collection_id: cid,
            }))
          )
        }

        // Optimistic UI: add to store instantly
        get().addMemory(memory)

        // ── STEP 2: Deferred AI tagging — ONLY if not a short note with local tags ──
        if (content?.trim() && !isShortNote) {
          get().backgroundAutoTag(memory.id, content, title || '')
        }

        // ── STEP 3: AI summary generation (background, non-blocking) ──
        if (content?.trim() && !isShortNote) {
          get().backgroundAutoSummary(memory.id, content)
        }

        // ── STEP 4: If this is a link, read the URL content (background, non-blocking) ──
        if (sourceUrl?.trim()) {
          get().backgroundReadLink(memory.id, sourceUrl)
        }

        // ── STEP 5: Generate embedding for semantic search (background, non-blocking) ──
        if (content?.trim()) {
          get().backgroundGenerateEmbedding(memory.id, content)
        }

        return memory
      } catch {
        // Fall through to Prisma API
      }
    }

    // ── Fallback: save via Prisma API ──
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          content,
          sourceUrl,
          tags: finalTags,
          collectionIds,
          imagePreview,
          fileUrl,
        }),
      })
      if (res.ok) {
        const memory: Memory = await res.json()
        get().addMemory(memory)

        // ── STEP 2: Deferred AI tagging — ONLY if not a short note with local tags ──
        if (content?.trim() && !isShortNote) {
          get().backgroundAutoTag(memory.id, content, title || '')
        }

        // ── STEP 3: AI summary generation (background, non-blocking) ──
        if (content?.trim() && !isShortNote) {
          get().backgroundAutoSummary(memory.id, content)
        }

        // ── STEP 4: If this is a link, read the URL content (background, non-blocking) ──
        if (sourceUrl?.trim()) {
          get().backgroundReadLink(memory.id, sourceUrl)
        }

        // ── STEP 5: Generate embedding for semantic search (background, non-blocking) ──
        if (content?.trim()) {
          get().backgroundGenerateEmbedding(memory.id, content)
        }

        return memory
      }
    } catch {
      // Silent fail
    }
    return null
  },

  // ── Save Collection (Supabase-aware) ────────────────────────────────
  saveCollection: async (data) => {
    const state = get()
    const { name, color, icon } = data

    // ── Authenticated + Supabase ready: save to Supabase directly ──
    if (state.isAuthenticated && state.supabaseReady) {
      try {
        const supabase = await getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No session')

        const { data: collectionRow, error } = await supabase
          .from('collections')
          .insert({
            user_id: session.user.id,
            name: name.trim(),
            color: color || '#6D597A',
            icon: icon || '📁',
          })
          .select('*, memory_collections(id)')
          .single()

        if (error) throw error

        const collection = mapSupabaseCollection(collectionRow as SupabaseCollectionRow)
        get().addCollection(collection)
        return collection
      } catch {
        // Fall through to Prisma API
      }
    }

    // ── Fallback: save via Prisma API ──
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color: color || '#6D597A', icon: icon || '📁' }),
      })
      if (res.ok) {
        const collection: Collection = await res.json()
        get().addCollection(collection)
        return collection
      }
    } catch {
      // Silent fail
    }
    return null
  },
}))
