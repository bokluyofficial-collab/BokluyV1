import { supabase } from './supabaseClient.js'

export async function ensureUserProfile(user) {
  if (!user?.id) return

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'User')

  const { error } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: displayName,
        role: 'user'
      },
      { onConflict: 'id' }
    )

  if (error) console.error('Profile upsert error:', error)
}
