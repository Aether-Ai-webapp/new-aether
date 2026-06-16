'use client'

import React, { useEffect } from 'react'
import { useAetherStore } from '@/lib/aether-store'
import { AppShell } from '@/components/aether/AppShell'
import { Dashboard } from '@/components/aether/Dashboard'
import { AskAether } from '@/components/aether/AskAether'
import { Collections } from '@/components/aether/Collections'
import { Memories } from '@/components/aether/Memories'
import { Settings } from '@/components/aether/Settings'
function ViewRouter() {
  const currentView = useAetherStore((s) => s.currentView)

  const views: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    ask: <AskAether />,
    collections: <Collections />,
    memories: <Memories />,
    settings: <Settings />,
  }

  return <>{views[currentView] || <Dashboard />}</>
}

function DataLoader({ children }: { children: React.ReactNode }) {
  const { fetchMemories, fetchCollections } = useAetherStore()

  useEffect(() => {
    // Fire and forget — UI renders immediately, data loads in background
    fetchMemories()
    fetchCollections()
  }, [fetchMemories, fetchCollections])

  return <>{children}</>
}

export default function Home() {
  const { checkSession } = useAetherStore()

  useEffect(() => {
    // Check auth session on mount — UI is already visible
    checkSession()
  }, [checkSession])

  // The app IS the landing page. Render immediately.
  return (
    <DataLoader>
      <AppShell>
        <ViewRouter />
      </AppShell>
    </DataLoader>
  )
}
