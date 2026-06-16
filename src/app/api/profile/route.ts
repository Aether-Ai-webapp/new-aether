import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/profile - Get the user profile
export async function GET() {
  try {
    let profile = await db.profile.findFirst()
    if (!profile) {
      // Create a default profile
      profile = await db.profile.create({
        data: { name: 'Aether User', email: 'user@aether.app' },
      })
    }
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      plan: profile.plan,
      darkMode: profile.darkMode,
    })
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// PATCH /api/profile - Update the user profile
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, darkMode, plan } = body

    let profile = await db.profile.findFirst()
    if (!profile) {
      profile = await db.profile.create({
        data: {
          name: name || 'Aether User',
          email: email || 'user@aether.app',
          darkMode: darkMode ?? false,
          plan: plan || 'free',
        },
      })
    } else {
      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (email !== undefined) updateData.email = email
      if (darkMode !== undefined) updateData.darkMode = darkMode
      if (plan !== undefined) updateData.plan = plan

      profile = await db.profile.update({
        where: { id: profile.id },
        data: updateData,
      })
    }

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      plan: profile.plan,
      darkMode: profile.darkMode,
    })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
