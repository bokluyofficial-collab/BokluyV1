import { supabase } from './supabaseClient.js'

const userMenu = document.getElementById('user-menu')
const userName = document.getElementById('user-name')
const logoutBtn = document.getElementById('logout-btn')
const loginLink = document.getElementById('login-link')

async function updateUserUI() {
  const { data: { session } } = await supabase.auth.getSession()

  // Logged out
  if (!session) {
    if (userMenu) userMenu.style.display = 'none'
    if (loginLink) loginLink.style.display = 'inline-flex'
    return
  }

  // Logged in
  if (loginLink) loginLink.style.display = 'none'
  if (userMenu) userMenu.style.display = 'flex'

  // Default name fallback
  let displayName =
    session.user.user_metadata?.display_name ||
    session.user.email ||
    'User'

  // Try to fetch profile name (safe)
  const { data, error } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!error && data?.display_name) {
    displayName = data.display_name
  }

  if (userName) userName.textContent = displayName
}

logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut()
  window.location.replace(getIndexUrl())
})

// Run once
updateUserUI()
