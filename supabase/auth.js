import { supabase } from './supabaseClient.js'
import { ensureUserProfile } from './profile.js'

const emailInput = document.getElementById('auth-email')
const passwordInput = document.getElementById('auth-password')
const nameInput = document.getElementById('register-name')
const msg = document.getElementById('message')

const loginTab = document.getElementById('login-tab')
const registerTab = document.getElementById('register-tab')
const registerOnly = document.getElementById('register-only')
const submitBtn = document.getElementById('submit-btn')
const title = document.getElementById('form-title')
const subtitle = document.getElementById('form-subtitle')

const googleLoginBtn = document.getElementById('googleLoginBtn')

let mode = 'login'
let redirected = false

function isLoggedOutLanding() {
  try {
    return new URLSearchParams(window.location.search).get('logged_out') === '1'
  } catch {
    return false
  }
}

function setMessage(text) {
  if (msg) msg.textContent = text || ''
}

function getAuthUrl() {
  // URL of THIS auth page (no hash)
  return window.location.href.split('#')[0]
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

async function resolveIndexUrl() {
  const here = new URL(window.location.href)
  const origin = here.origin
  const folder = new URL('.', here).toString() // current folder URL

  const candidates = []
  const add = (u) => { if (u && !candidates.includes(u)) candidates.push(u) }

  // same folder as auth.html
  add(new URL('index.html', folder).toString())
  // parent folder
  add(new URL('../index.html', folder).toString())
  // site root
  add(new URL('/index.html', origin).toString())

  // also try "/<firstFolder>/index.html" if we’re in a nested folder
  const parts = here.pathname.split('/').filter(Boolean)
  if (parts.length >= 2) {
    add(new URL(`/${parts[0]}/index.html`, origin).toString())
  }

  for (const u of candidates) {
    if (await urlExists(u)) return u
  }

  return null
}

async function goHomeOnce(user) {
  if (redirected) return
  redirected = true

  try {
    if (user) await ensureUserProfile(user)
  } catch (e) {
    console.error('ensureUserProfile failed:', e)
  }

  const indexUrl = await resolveIndexUrl()
  if (!indexUrl) {
    setMessage('Could not find index.html. Check your Live Server root/folder.')
    redirected = false
    return
  }

  // already there? stop
  if (window.location.href.split('#')[0] === indexUrl.split('#')[0]) return

  window.location.replace(indexUrl)
}

// Tabs
loginTab?.addEventListener('click', () => {
  mode = 'login'
  loginTab.classList.add('active')
  registerTab?.classList.remove('active')
  if (registerOnly) registerOnly.style.display = 'none'
  if (title) title.textContent = 'Login'
  if (subtitle) subtitle.textContent = 'Login to continue'
  if (submitBtn) submitBtn.textContent = 'Login'
  setMessage('')
})

registerTab?.addEventListener('click', () => {
  mode = 'register'
  registerTab.classList.add('active')
  loginTab?.classList.remove('active')
  if (registerOnly) registerOnly.style.display = 'block'
  if (title) title.textContent = 'Register'
  if (subtitle) subtitle.textContent = 'Create a new account'
  if (submitBtn) submitBtn.textContent = 'Register'
  setMessage('')
})

// Google OAuth (Login/Register) — redirect back to auth.html (always exists)
googleLoginBtn?.addEventListener('click', async () => {
  setMessage('')
  googleLoginBtn.disabled = true

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthUrl() }
    })
    if (error) setMessage(error.message)
  } catch (e) {
    console.error(e)
    setMessage('Google login failed. Please try again.')
  } finally {
    googleLoginBtn.disabled = false
  }
})

// Email/Password submit
submitBtn?.addEventListener('click', async () => {
  setMessage('')

  const email = emailInput?.value?.trim()
  const password = passwordInput?.value?.trim()

  if (!email || !password) {
    setMessage('Please fill all fields')
    return
  }

  submitBtn.disabled = true

  try {
    if (mode === 'register') {
      const displayName = nameInput?.value?.trim()
      if (!displayName) {
        setMessage('Display name required')
        return
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      })

      setMessage(error ? error.message : 'Check your email to confirm your account')
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
        return
      }
      await goHomeOnce(data.user)
    }
  } catch (e) {
    console.error(e)
    setMessage('Something went wrong. Please try again.')
  } finally {
    submitBtn.disabled = false
  }
})

// If already signed in and user visits auth.html, go home ONCE
supabase.auth.getSession().then(({ data }) => {
  const user = data?.session?.user
  if (user && /auth\.html$/i.test(window.location.pathname) && !isLoggedOutLanding()) {
    goHomeOnce(user)
  }
})

// Catch OAuth completion event
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    goHomeOnce(session.user)
  }
})
