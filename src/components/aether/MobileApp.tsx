'use client'

import React from 'react'
import { AppShell } from '@/components/aether/AppShell'
import { AuthDrawer } from '@/components/aether/AuthModal'

export function MobileApp({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>
        {children}
      </AppShell>
      <AuthDrawer />
    </>
  )
}
